/// PerceptualHash.swift
///
/// Perceptual hashing (pHash) for image similarity comparison.
/// Used to deduplicate near-identical frames from screen recordings.
///
/// Algorithm:
/// 1. Resize image to 32x32
/// 2. Convert to grayscale
/// 3. Apply DCT (discrete cosine transform)
/// 4. Take top-left 8x8 of DCT coefficients
/// 5. Compute median, create 64-bit hash based on above/below median

import AppKit
import Accelerate

/// A perceptual hash for comparing image similarity
struct PerceptualHash {
    /// The 64-bit hash value
    let hash: UInt64

    /// Compute perceptual hash from an image
    init(image: NSImage) {
        // 1. Resize to 32x32
        let resized = Self.resize(image: image, to: CGSize(width: 32, height: 32))

        // 2. Convert to grayscale pixel values
        let grayscale = Self.toGrayscale(image: resized)

        // 3. Apply DCT
        let dct = Self.applyDCT(pixels: grayscale, width: 32, height: 32)

        // 4. Take top-left 8x8 (excluding DC component at [0,0])
        var values: [Float] = []
        for y in 0..<8 {
            for x in 0..<8 {
                if x == 0 && y == 0 { continue } // Skip DC component
                values.append(dct[y * 32 + x])
            }
        }

        // 5. Compute median and create hash
        let sorted = values.sorted()
        let median = sorted[sorted.count / 2]

        var hashValue: UInt64 = 0
        for (i, value) in values.enumerated() {
            if value > median {
                hashValue |= (1 << i)
            }
        }

        self.hash = hashValue
    }

    /// Calculate similarity to another hash (0.0 to 1.0)
    func similarity(to other: PerceptualHash) -> Double {
        let xor = hash ^ other.hash
        let differentBits = xor.nonzeroBitCount
        return 1.0 - (Double(differentBits) / 64.0)
    }

    // MARK: - Private Helpers

    private static func resize(image: NSImage, to size: CGSize) -> NSImage {
        let newImage = NSImage(size: size)
        newImage.lockFocus()
        NSGraphicsContext.current?.imageInterpolation = .high
        image.draw(in: NSRect(origin: .zero, size: size),
                   from: NSRect(origin: .zero, size: image.size),
                   operation: .copy,
                   fraction: 1.0)
        newImage.unlockFocus()
        return newImage
    }

    private static func toGrayscale(image: NSImage) -> [Float] {
        guard let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
            return Array(repeating: 0, count: 32 * 32)
        }

        let width = cgImage.width
        let height = cgImage.height
        var pixels = [Float](repeating: 0, count: width * height)

        let colorSpace = CGColorSpaceCreateDeviceGray()
        guard let context = CGContext(
            data: &pixels,
            width: width,
            height: height,
            bitsPerComponent: 32,
            bytesPerRow: width * 4,
            space: colorSpace,
            bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.none.rawValue | CGBitmapInfo.floatComponents.rawValue).rawValue
        ) else {
            return pixels
        }

        context.draw(cgImage, in: CGRect(x: 0, y: 0, width: width, height: height))
        return pixels
    }

    private static func applyDCT(pixels: [Float], width: Int, height: Int) -> [Float] {
        var input = pixels
        var output = [Float](repeating: 0, count: width * height)

        // Use Accelerate's vDSP for DCT
        let setup = vDSP_DCT_CreateSetup(nil, vDSP_Length(width * height), .II)
        defer { vDSP_DCT_DestroySetup(setup) }

        if let setup = setup {
            vDSP_DCT_Execute(setup, &input, &output)
        } else {
            // Fallback: simple 2D DCT implementation
            output = simpleDCT(pixels: pixels, width: width, height: height)
        }

        return output
    }

    private static func simpleDCT(pixels: [Float], width: Int, height: Int) -> [Float] {
        var result = [Float](repeating: 0, count: width * height)
        let pi = Float.pi

        for v in 0..<8 {
            for u in 0..<8 {
                var sum: Float = 0
                for y in 0..<height {
                    for x in 0..<width {
                        let pixel = pixels[y * width + x]
                        let cosX = cos(pi * Float(2 * x + 1) * Float(u) / Float(2 * width))
                        let cosY = cos(pi * Float(2 * y + 1) * Float(v) / Float(2 * height))
                        sum += pixel * cosX * cosY
                    }
                }
                let cu: Float = u == 0 ? 1.0 / sqrt(2.0) : 1.0
                let cv: Float = v == 0 ? 1.0 / sqrt(2.0) : 1.0
                result[v * width + u] = 0.25 * cu * cv * sum
            }
        }

        return result
    }
}

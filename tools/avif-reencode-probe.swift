import Foundation
import ImageIO
import CoreGraphics
let args = CommandLine.arguments
guard let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: args[1]) as CFURL, nil),
      let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else { exit(1) }
print("source px: \(img.width)x\(img.height)")
for side in [384, 448, 512] {
  for q in [0.55, 0.7, 0.8] {
    let cs = CGColorSpaceCreateDeviceRGB()
    guard let ctx = CGContext(data: nil, width: side, height: side, bitsPerComponent: 8,
        bytesPerRow: 0, space: cs, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { continue }
    ctx.interpolationQuality = .high
    ctx.draw(img, in: CGRect(x: 0, y: 0, width: side, height: side))
    guard let out = ctx.makeImage() else { continue }
    let data = NSMutableData()
    guard let dest = CGImageDestinationCreateWithData(data, "public.avif" as CFString, 1, nil) else { continue }
    CGImageDestinationAddImage(dest, out, [kCGImageDestinationLossyCompressionQuality: q] as CFDictionary)
    CGImageDestinationFinalize(dest)
    let b64 = data.length * 4 / 3
    print(String(format: "avif %dpx q%.2f -> %6d bytes raw / %6d bytes base64", side, q, data.length, b64))
  }
}

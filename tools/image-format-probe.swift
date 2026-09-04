import Foundation
import ImageIO
import CoreGraphics
import UniformTypeIdentifiers
let types = CGImageDestinationCopyTypeIdentifiers() as! [String]
for t in ["public.webp", "public.heic", "public.jpeg", "public.png", "public.avif"] {
    print(t, types.contains(t) ? "ENCODE OK" : "not supported")
}

declare module "cors";
declare module "cookie-parser";

declare namespace google {
  namespace maps {
    interface LatLngLiteral { lat: number; lng: number }
    class Map { constructor(element: HTMLElement, options?: unknown); setCenter(center: LatLngLiteral): void }
  }
}

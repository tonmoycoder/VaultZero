import { DitheringShader } from "@/components/ui/dithering-shader";

export default function DemoOne() {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden">
      <DitheringShader 
        shape="wave"
        type="8x8"
        colorBack="#001122"
        colorFront="#ff0088"
        pxSize={3}
        speed={0.6}
      />
      <span className="pointer-events-none z-10 text-center text-7xl leading-none absolute font-semibold text-white tracking-tighter whitespace-pre-wrap">
        Wave
      </span>
    </div>
  );
}


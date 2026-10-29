import DemoOne from "@/components/ui/demo";
import { Component as WaveComponent } from "@/components/ui/wave-1";

export function App() {
  return (
    <main className="h-screen w-screen flex flex-col items-center justify-center bg-background text-foreground relative overflow-hidden">
      <DemoOne />
      <div className="absolute bottom-8 z-20 backdrop-blur-md bg-background/60 p-4 rounded-xl border border-border shadow-2xl">
        <WaveComponent />
      </div>
    </main>
  );
}

export default App;

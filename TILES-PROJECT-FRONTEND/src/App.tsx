import { ModeToggle } from "./components/mode-toggle";
import { TileBarChart } from "./components/TileBarChart";
import { ThemeProvider } from "@/components/theme-provider";

function App() {
  return (
    <div>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <div className=" flex justify-end p-4">
          <ModeToggle />
        </div>
        <TileBarChart />
      </ThemeProvider>
    </div>
  );
}

export default App;

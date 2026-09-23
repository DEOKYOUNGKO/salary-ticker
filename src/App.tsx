import Widget from "./widget/Widget";
import { HARDCODED_SETTINGS } from "./settings";

export default function App() {
  return <Widget settings={HARDCODED_SETTINGS} />;
}

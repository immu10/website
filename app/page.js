// app/page.js  ->  the root "/"
// We don't show content here; we redirect visitors to /home.

import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/home");
}

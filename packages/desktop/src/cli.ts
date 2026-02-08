import { message } from "@tauri-apps/plugin-dialog"

export async function installCli(): Promise<void> {
  await message(
    "Install the Papert Code CLI by running:\n\n" +
      "npm install -g @papert-code/papert-code\n\n" +
      "Restart your terminal and run 'papert --version' to confirm.",
    {
      title: "Install Papert Code CLI",
    },
  )
}

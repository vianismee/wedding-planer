export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { dbReady } = await import("./db");
    await dbReady();
  }
}

// Send settings to a ProbeHarbor probe over USB and wait for its first reading.
// Wire format (115200 baud): "TTEXTRAS<TAB>leak,door\nTTCFG<TAB>ssid<TAB>password<TAB>key\n".
// The probe answers with lines that start "TT ".
import { FIRMWARE } from "../i18n/strings/firmware";
import { pageLocale, translator } from "../i18n/t";

const t = translator(FIRMWARE, pageLocale());

interface SerialPortLike {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  setSignals?(signals: { dataTerminalReady?: boolean; requestToSend?: boolean }): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
}
interface SerialLike {
  requestPort(): Promise<SerialPortLike>;
}

const RESEND_EVERY_MS = 5000;
const GIVE_UP_AFTER_MS = 90_000;

const sleep = (ms: number) => new Promise<null>((resolve) => setTimeout(() => resolve(null), ms));

/** Tabs separate the fields on the wire, so they cannot appear inside one. */
const clean = (value: FormDataEntryValue | null) => String(value ?? "").replace(/[\t\r\n]/g, "").trim();

const FAILURES = ["TT wifi failed", "TT key rejected", "TT config error", "TT no probe", "TT nothing sent"];

for (const root of document.querySelectorAll<HTMLElement>("[data-probe-setup]")) {
  const form = root.querySelector<HTMLFormElement>("[data-setup-form]");
  const status = root.querySelector<HTMLElement>("[data-setup-status]");
  const log = root.querySelector<HTMLElement>("[data-setup-log]");
  const button = root.querySelector<HTMLButtonElement>("[data-setup-send]");
  if (!form || !status || !log || !button) continue;

  const serial = (navigator as Navigator & { serial?: SerialLike }).serial;
  if (!serial) {
    button.disabled = true;
    status.textContent = t("noWebSerial");
    continue;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const ssid = clean(data.get("ssid"));
    // A password may start or end with a space; only strip the separators.
    const password = String(data.get("password") ?? "").replace(/[\t\r\n]/g, "");
    const key = clean(data.get("key"));
    if (!ssid || !key) return;

    button.disabled = true;
    log.hidden = false;
    log.textContent = "";
    status.textContent = t("pickPort");

    let port: SerialPortLike | null = null;
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    try {
      port = await serial.requestPort();
      await port.open({ baudRate: 115200 });
      // Opening the port resets many dev boards; release the lines and let it boot.
      await port.setSignals?.({ dataTerminalReady: false, requestToSend: false });
      status.textContent = t("waitStart");
      await sleep(2500);
      if (!port.writable || !port.readable) throw new Error(t("portNoRW"));

      const writer = port.writable.getWriter();
      // Extras go on their own line first: firmware 1.2+ saves them and older
      // firmware ignores lines it does not know.
      const extras = data.getAll("extras").map(String).join(",");
      const send = () =>
        writer.write(new TextEncoder().encode(`TTEXTRAS\t${extras}\nTTCFG\t${ssid}\t${password}\t${key}\n`));
      reader = port.readable.getReader();

      const decoder = new TextDecoder();
      const startedAt = Date.now();
      let lastSent = 0;
      let acknowledged = false;
      let sensor: string | null = null;
      // The last failed upload. The board keeps retrying, so this only becomes
      // the final message if no reading arrives in time.
      let postProblem: string | null = null;
      let buffer = "";
      let outcome: "ok" | "failed" | "timeout" = "timeout";
      // Keep one read pending across loop passes. Starting a new read each time
      // the one-second tick wins would hand the next bytes to an abandoned promise.
      let pendingRead: Promise<ReadableStreamReadResult<Uint8Array>> | null = null;

      while (Date.now() - startedAt < GIVE_UP_AFTER_MS) {
        if (!acknowledged && Date.now() - lastSent > RESEND_EVERY_MS) {
          await send();
          lastSent = Date.now();
          status.textContent = t("sendingSettings");
        }
        pendingRead ??= reader.read();
        const chunk = await Promise.race([pendingRead, sleep(1000)]);
        if (!chunk) continue;
        pendingRead = null;
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith("TT ")) continue;
          log.textContent += `${line.slice(3)}\n`;

          if (line === "TT key saved") {
            acknowledged = true;
            status.textContent = t("probeHasSettings");
          } else if (line === "TT wifi ok") {
            status.textContent = t("onWifi");
          } else if (line.startsWith("TT sensor: ")) {
            sensor = line.slice("TT sensor: ".length).split(" on ")[0] ?? null;
          } else if (/^TT post 2\d\d /.test(line)) {
            outcome = "ok";
          } else if (line.startsWith("TT post failed")) {
            postProblem = t("probeNoReach");
            status.textContent = postProblem;
          } else if (/^TT post -\d+ /.test(line)) {
            // The HTTP client's own errors, such as -5 for a lost connection.
            // The reading may still have arrived.
            const code = /^TT post (-\d+)/.exec(line)?.[1] ?? "";
            postProblem = t("replyLost", { code });
            status.textContent = postProblem;
          } else if (/^TT post \d{3} /.test(line)) {
            // 401 and 403 are followed by "TT key rejected", handled below.
            const code = line.slice("TT post ".length, "TT post ".length + 3);
            if (code !== "401" && code !== "403") {
              postProblem = t("phAnswered", { code });
              status.textContent = postProblem;
            }
          } else if (FAILURES.some((f) => line.startsWith(f))) {
            outcome = "failed";
            // The firmware's own wording says what to fix.
            status.textContent = `${line.slice(3)}.`;
          }
        }
        if (outcome !== "timeout") break;
      }

      writer.releaseLock();
      if (outcome === "ok") {
        status.textContent = sensor
          ? t("liveSensor", { sensor })
          : t("live");
      } else if (outcome === "timeout") {
        status.textContent =
          postProblem ??
          (acknowledged
            ? t("noReading")
            : t("probeNoAnswer"));
      }
    } catch (error) {
      status.textContent =
        error instanceof DOMException && error.name === "NotFoundError"
          ? t("noPort")
          : t("cannotTalk", { error: error instanceof Error ? error.message : String(error) });
    } finally {
      try {
        await reader?.cancel();
        reader?.releaseLock();
        await port?.close();
      } catch {
        // The port is already gone, for example because the cable was pulled.
      }
      button.disabled = false;
    }
  });
}

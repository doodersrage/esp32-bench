// A small wrapper around Web Serial: open a port, get whole lines back, write
// lines, pulse reset. Used by the Detective page and the bench's second board.

// Minimal Web Serial types: the API is not in TypeScript's DOM library yet.
export interface SerialPortLike extends EventTarget {
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  setSignals(signals: { dataTerminalReady?: boolean; requestToSend?: boolean }): Promise<void>;
}
export interface SerialLike extends EventTarget {
  requestPort(): Promise<SerialPortLike>;
}

export const getSerial = (): SerialLike | undefined => (navigator as Navigator & { serial?: SerialLike }).serial;

export interface SessionHandlers {
  onLine(line: string): void;
  /** Called once when the port closes. `lost` is true when it was not asked for. */
  onClose(lost: boolean): void;
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export class SerialSession {
  private port: SerialPortLike | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private reading = false;
  private done: Promise<void> | null = null;

  constructor(private handlers: SessionHandlers) {
    getSerial()?.addEventListener("disconnect", (e) => {
      if (this.port && e.target === this.port) void this.close(true);
    });
  }

  get connected(): boolean {
    return this.port !== null;
  }

  /**
   * Ask the user for a port and open it.
   * Returns "ok", "cancelled" when no port was picked, or a message to show.
   */
  async open(baudRate: number): Promise<string> {
    const serial = getSerial();
    if (!serial) return "This browser has no Web Serial. Use Chrome or Edge on a desktop.";
    let picked: SerialPortLike;
    try {
      picked = await serial.requestPort();
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      if (name === "NotFoundError") return "cancelled";
      return name === "SecurityError"
        ? "This page is not allowed to use serial ports. Open it from https or http://localhost."
        : `Could not open the port picker: ${errorText(e)}`;
    }
    try {
      await picked.open({ baudRate });
    } catch (e) {
      return `Could not open the port: ${errorText(e)}. Close any other serial monitor that is using it.`;
    }
    this.port = picked;
    this.reading = true;
    this.done = this.readLoop().then(() => {
      if (this.reading) void this.close(true);
    });
    return "ok";
  }

  private async readLoop() {
    const decoder = new TextDecoder();
    let buffer = "";
    let idle: ReturnType<typeof setTimeout> | undefined;
    // A partial line is delivered once the board has been quiet for a moment.
    const flush = () => {
      if (buffer) {
        this.handlers.onLine(buffer.replace(/\r$/, ""));
        buffer = "";
      }
    };
    while (this.reading && this.port?.readable) {
      this.reader = this.port.readable.getReader();
      let ended = false;
      try {
        for (;;) {
          const { value, done } = await this.reader.read();
          if (done) {
            ended = true;
            break;
          }
          clearTimeout(idle);
          buffer += decoder.decode(value, { stream: true });
          let i: number;
          while ((i = buffer.indexOf("\n")) >= 0) {
            this.handlers.onLine(buffer.slice(0, i).replace(/\r$/, ""));
            buffer = buffer.slice(i + 1);
          }
          idle = setTimeout(flush, 300);
        }
      } catch {
        // A framing or overrun error ends this reader; the outer loop gets a new one.
      } finally {
        try {
          this.reader.releaseLock();
        } catch {
          // Already released.
        }
        this.reader = null;
      }
      if (ended) break;
    }
    clearTimeout(idle);
    flush();
  }

  async close(lost = false) {
    const closing = this.port;
    if (!closing) return;
    this.port = null;
    this.reading = false;
    try {
      await this.reader?.cancel();
    } catch {
      // The stream may already be closed.
    }
    if (!lost) {
      try {
        await this.done;
      } catch {
        // Nothing to do.
      }
    }
    try {
      await closing.close();
    } catch {
      // An unplugged board cannot be closed cleanly.
    }
    this.handlers.onClose(lost);
  }

  /** Write text as-is. Returns an error message, or "" when it was sent. */
  async write(text: string): Promise<string> {
    if (!this.port?.writable) return "No board connected.";
    const writer = this.port.writable.getWriter();
    try {
      await writer.write(new TextEncoder().encode(text));
      return "";
    } catch (e) {
      return errorText(e);
    } finally {
      writer.releaseLock();
    }
  }

  /** Pulse EN through the usual auto-reset circuit. Returns an error message or "". */
  async reset(): Promise<string> {
    if (!this.port) return "No board connected.";
    try {
      await this.port.setSignals({ dataTerminalReady: false, requestToSend: true });
      await new Promise((r) => setTimeout(r, 120));
      await this.port.setSignals({ dataTerminalReady: false, requestToSend: false });
      return "";
    } catch (e) {
      return errorText(e);
    }
  }
}

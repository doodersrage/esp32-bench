// Flashing over Web Serial with esptool-js, shared by the flash tool
// (/tools/flash/) and the sketch editor. esptool-js is loaded only when a
// board is connected, so pages that never flash never download it.
import type { ESPLoader, IEspLoaderTerminal, Transport } from "esptool-js";
import { bootloaderOffset } from "./flash-plan";

export interface FlashSession {
  loader: ESPLoader;
  transport: Transport;
  /** esptool's chip name, e.g. "ESP32-C3" */
  chipName: string;
  /** Where this chip's second-stage bootloader lives */
  bootOffset: number;
  /** esptool's one-line description of the chip */
  description: string;
}

export interface FlashPart {
  data: Uint8Array;
  address: number;
}

type SerialPortArg = ConstructorParameters<typeof Transport>[0];

/** Browsers with Web Serial expose navigator.serial. */
export function serialSupport(): { supported: boolean; secure: boolean } {
  return {
    supported: typeof navigator !== "undefined" && "serial" in navigator,
    secure: typeof window !== "undefined" && window.isSecureContext,
  };
}

/** Ask for a port, load esptool-js and talk to the bootloader. */
export async function openSession(port: SerialPortArg, baudrate: number, terminal: IEspLoaderTerminal): Promise<FlashSession> {
  const { ESPLoader, Transport } = await import("esptool-js");
  const transport = new Transport(port, false);
  const loader = new ESPLoader({ transport, baudrate, terminal, debugLogging: false });
  try {
    const description = await loader.main();
    const chipName = loader.chip.CHIP_NAME;
    const bootOffset =
      typeof loader.chip.BOOTLOADER_FLASH_OFFSET === "number" ? loader.chip.BOOTLOADER_FLASH_OFFSET : bootloaderOffset(chipName);
    return { loader, transport, chipName, bootOffset, description };
  } catch (err) {
    await transport.disconnect().catch(() => undefined);
    throw err;
  }
}

/**
 * Write the parts, then reset the board so it runs the new firmware.
 * `onProgress` gets the overall percentage and the index of the part being written.
 */
export async function writeAndReset(
  session: FlashSession,
  parts: FlashPart[],
  options: { eraseAll?: boolean; onProgress?: (percent: number, index: number) => void } = {},
): Promise<void> {
  const total = parts.reduce((n, p) => n + p.data.length, 0) || 1;
  const done = new Array(parts.length).fill(0);
  await session.loader.writeFlash({
    fileArray: parts,
    flashSize: "keep",
    flashMode: "keep",
    flashFreq: "keep",
    eraseAll: options.eraseAll ?? false,
    compress: true,
    reportProgress: (index, written, size) => {
      done[index] = (written / size) * parts[index].data.length;
      const pct = Math.min(100, Math.round((done.reduce((a, b) => a + b, 0) / total) * 100));
      options.onProgress?.(pct, index);
    },
  });
  await session.loader.after("hard_reset");
}

export async function closeSession(session: FlashSession | null): Promise<void> {
  try {
    await session?.transport.disconnect();
  } catch {
    // Already closed.
  }
}

/** One merged image (bootloader, partitions and app) is written at offset 0. */
export async function flashMergedImage(
  port: SerialPortArg,
  image: Uint8Array,
  options: { baudrate?: number; terminal: IEspLoaderTerminal; onProgress?: (percent: number) => void; expectChip?: string },
): Promise<FlashSession> {
  const session = await openSession(port, options.baudrate ?? 921600, options.terminal);
  try {
    if (options.expectChip && !sameChip(session.chipName, options.expectChip)) {
      throw new Error(`This image is for the ${options.expectChip.toUpperCase()}, but the connected board is an ${session.chipName}.`);
    }
    await writeAndReset(session, [{ data: image, address: 0 }], { onProgress: (pct) => options.onProgress?.(pct) });
    return session;
  } finally {
    await closeSession(session);
  }
}

/** "ESP32-C3" from esptool and "esp32c3" from the compiler name the same chip. */
export function sameChip(esptoolName: string, chip: string): boolean {
  return esptoolName.toLowerCase().replace(/[^a-z0-9]/g, "") === chip.toLowerCase().replace(/[^a-z0-9]/g, "");
}

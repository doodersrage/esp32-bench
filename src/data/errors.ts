// ESP32 error reference: one entry per error line people search for.
// Entries with `keys` correspond to findings from src/lib/crash.ts. The error
// pages check at build time that every such example is still recognised by
// explainLog, so this data and the bench's translator cannot drift apart.

export type ErrorGroup = "crash" | "reset" | "boot" | "upload";

export const GROUPS: [ErrorGroup, string, string][] = [
  ["crash", "Crashes", "Guru Meditation errors, aborts and watchdogs: the firmware hit something it could not recover from."],
  ["reset", "Resets and power", "The rst: line printed at every boot, and what each reason means."],
  ["boot", "Boot and flash", "The bootloader could not find or read the firmware, or is waiting for new firmware."],
  ["upload", "Upload and connection", "Errors from esptool and the Arduino IDE while uploading."],
];

export interface ErrorEntry {
  /** URL slug: /errors/<slug>/ */
  slug: string;
  /** The error as people search for it */
  title: string;
  group: ErrorGroup;
  /** The exact text it appears as in the serial output or upload log */
  match: string;
  /** Example output, as printed */
  example: string[];
  /** Plain-language meaning */
  means: string;
  causes: string[];
  fixes: string[];
  /** Slugs of related entries */
  related: string[];
  /** Finding keys from src/lib/crash.ts that this example must produce */
  keys?: string[];
}

export const ERRORS: ErrorEntry[] = [
  // Crashes
  {
    slug: "guru-meditation-loadprohibited",
    title: "Guru Meditation Error: Core 1 panic'ed (LoadProhibited)",
    group: "crash",
    match: "Guru Meditation Error: Core  1 panic'ed (LoadProhibited). Exception was unhandled.",
    example: [
      "Guru Meditation Error: Core  1 panic'ed (LoadProhibited). Exception was unhandled.",
      "",
      "Core  1 register dump:",
      "PC      : 0x400d1a2b  PS      : 0x00060230  A0      : 0x800d2c3d  A1      : 0x3ffb1f10",
      "EXCVADDR: 0x00000008",
      "",
      "Backtrace: 0x400d1a2b:0x3ffb1f10 0x400d2c3d:0x3ffb1f30 0x400d8f4e:0x3ffb1f50",
    ],
    means:
      "The code tried to read memory at an address it may not touch. On the ESP32-C3 and other RISC-V chips the same fault is reported as \"Load access fault\". An EXCVADDR close to 0x00000000 almost always means a null pointer: the code read a field of an object that was never created.",
    causes: [
      "Using a sensor, display or client object whose begin() failed, or that was never allocated.",
      "A pointer to an object that has already been deleted, or to a local variable of a function that has returned.",
      "Reading past the end of an array into unmapped memory.",
      "A String or buffer used from two tasks at once without a lock.",
    ],
    fixes: [
      "Check every begin() return value and stop with a clear Serial message when it fails, before the object is used.",
      "Decode the Backtrace line to find the function and line that crashed (see the backtrace page).",
      "Look at EXCVADDR: a small value such as 0x00000008 is a field read through a null pointer.",
      "Initialise pointers to nullptr and test them before use.",
    ],
    related: ["decode-esp32-backtrace", "guru-meditation-storeprohibited", "sw-cpu-reset"],
    keys: ["panic-load", "backtrace"],
  },
  {
    slug: "guru-meditation-storeprohibited",
    title: "Guru Meditation Error: Core 1 panic'ed (StoreProhibited)",
    group: "crash",
    match: "Guru Meditation Error: Core  1 panic'ed (StoreProhibited). Exception was unhandled.",
    example: [
      "Guru Meditation Error: Core  1 panic'ed (StoreProhibited). Exception was unhandled.",
      "EXCVADDR: 0x00000000",
      "Backtrace: 0x400d14f2:0x3ffb1f20 0x400d3a11:0x3ffb1f40",
    ],
    means:
      "The code tried to write to an address it may not touch. The RISC-V chips (ESP32-C3, C6, H2) report it as \"Store access fault\". Like LoadProhibited, an EXCVADDR near zero points at a null pointer.",
    causes: [
      "Writing through a null or uninitialised pointer.",
      "Writing past the end of an array or a buffer from malloc().",
      "Using memory after it has been freed.",
    ],
    fixes: [
      "Decode the backtrace to find the line that wrote.",
      "Check array indexes and buffer sizes in that function, especially loops that use <= instead of <.",
      "Replace sprintf and strcpy with snprintf and strlcpy so writes cannot overrun.",
    ],
    related: ["guru-meditation-loadprohibited", "corrupt-heap", "decode-esp32-backtrace"],
    keys: ["panic-store", "backtrace"],
  },
  {
    slug: "guru-meditation-instrfetchprohibited",
    title: "Guru Meditation Error: Core 1 panic'ed (InstrFetchProhibited)",
    group: "crash",
    match: "Guru Meditation Error: Core  1 panic'ed (InstrFetchProhibited). Exception was unhandled.",
    example: [
      "Guru Meditation Error: Core  1 panic'ed (InstrFetchProhibited). Exception was unhandled.",
      "PC      : 0x00000000  PS      : 0x00060a30  A0      : 0x800d2f61",
    ],
    means:
      "The CPU jumped to an address that holds no code. The RISC-V chips report it as \"Instruction access fault\". A PC of 0x00000000 means the code called a function pointer that was never set.",
    causes: [
      "Calling a callback or function pointer that is still null.",
      "A virtual method called on an object that was deleted or never constructed.",
      "A stack overflow that overwrote a saved return address.",
    ],
    fixes: [
      "Check callbacks for null before calling them.",
      "If the PC looks random rather than zero, suspect a stack overflow and give the task a bigger stack.",
      "Decode the backtrace; the first address may be garbage, so read the ones after it.",
    ],
    related: ["stack-canary-watchpoint", "guru-meditation-loadprohibited", "decode-esp32-backtrace"],
    keys: ["panic-fetch"],
  },
  {
    slug: "guru-meditation-illegalinstruction",
    title: "Guru Meditation Error: Core 1 panic'ed (IllegalInstruction)",
    group: "crash",
    match: "Guru Meditation Error: Core  1 panic'ed (IllegalInstruction). Exception was unhandled.",
    example: [
      "Guru Meditation Error: Core  1 panic'ed (IllegalInstruction). Exception was unhandled.",
      "Memory dump at 0x400d2a10: 00000000 00000000 00000000",
    ],
    means:
      "The CPU reached bytes that are not a valid instruction. On the RISC-V chips it reads \"Illegal instruction\". With GCC, the most common cause in Arduino code is a function declared to return a value that falls off its end without a return statement.",
    causes: [
      "A non-void function with a path that has no return statement. GCC is allowed to emit an invalid instruction there.",
      "Memory corruption that overwrote code pointers or the stack.",
      "Firmware built for one chip flashed to another.",
    ],
    fixes: [
      "Turn on all compiler warnings (File > Preferences > Compiler warnings: All) and fix every \"control reaches end of non-void function\" warning.",
      "Check that the board selected in Tools > Board matches the chip on your board.",
      "Decode the backtrace to find the function.",
    ],
    related: ["guru-meditation-instrfetchprohibited", "decode-esp32-backtrace"],
    keys: ["panic-illegal"],
  },
  {
    slug: "guru-meditation-integerdividebyzero",
    title: "Guru Meditation Error: Core 1 panic'ed (IntegerDivideByZero)",
    group: "crash",
    match: "Guru Meditation Error: Core  1 panic'ed (IntegerDivideByZero). Exception was unhandled.",
    example: ["Guru Meditation Error: Core  1 panic'ed (IntegerDivideByZero). Exception was unhandled."],
    means:
      "An integer was divided by zero, which the Xtensa chips (classic ESP32 and S3) trap. RISC-V chips such as the C3 do not trap integer division by zero; the result is simply wrong instead.",
    causes: [
      "Averaging over a count that can be zero, such as samples taken before the first reading.",
      "Dividing by a sensor value that can read 0, or by millis() differences that can be 0.",
      "Using % with a zero divisor.",
    ],
    fixes: [
      "Guard every division whose divisor comes from a reading, a count or a size: if (n == 0) skip or return.",
      "Decode the backtrace to find the division.",
    ],
    related: ["decode-esp32-backtrace", "guru-meditation-loadprohibited"],
    keys: ["panic-div0"],
  },
  {
    slug: "stack-canary-watchpoint",
    title: "Stack canary watchpoint triggered (loopTask)",
    group: "crash",
    match: "Debug exception reason: Stack canary watchpoint triggered (loopTask)",
    example: [
      "Guru Meditation Error: Core  1 panic'ed (Unhandled debug exception).",
      "Debug exception reason: Stack canary watchpoint triggered (loopTask)",
    ],
    means:
      "A task used more stack than it was given and ran into the guard at the end of its stack. The name in brackets is the task: loopTask is the task that runs setup() and loop() in Arduino.",
    causes: [
      "A large local array or buffer inside a function, such as char buf[8192].",
      "Deep or unbounded recursion.",
      "A task created with xTaskCreate or xTaskCreatePinnedToCore with too small a stack size.",
      "Libraries that need a lot of stack, such as TLS (WiFiClientSecure) or JSON parsing, called from a small task.",
    ],
    fixes: [
      "Make big buffers static, global, or allocate them with malloc() once.",
      "Give loopTask more stack by adding SET_LOOP_TASK_STACK_SIZE(16 * 1024); at file scope in the sketch. The default is 8 KB.",
      "For your own tasks, raise the stack size argument and check usage with uxTaskGetStackHighWaterMark(NULL).",
    ],
    related: ["guru-meditation-instrfetchprohibited", "stack-smashing-protect-failure"],
    keys: ["panic-stack"],
  },
  {
    slug: "interrupt-wdt-timeout",
    title: "Guru Meditation Error: Core 0 panic'ed (Interrupt wdt timeout on CPU0)",
    group: "crash",
    match: "Guru Meditation Error: Core  0 panic'ed (Interrupt wdt timeout on CPU0).",
    example: ["Guru Meditation Error: Core  0 panic'ed (Interrupt wdt timeout on CPU0)."],
    means:
      "Interrupts were blocked on one core for longer than the interrupt watchdog allows, about 300 ms by default. The chip panics so it does not hang.",
    causes: [
      "Long work inside an interrupt handler: Serial.print, delay(), I2C or SPI transfers, or loops waiting on hardware.",
      "A critical section (portENTER_CRITICAL or noInterrupts()) held for a long time.",
      "A spin-wait in an interrupt on a flag that another task sets.",
    ],
    fixes: [
      "Keep interrupt handlers to a few lines: set a volatile flag or give a semaphore, then do the work in loop() or a task.",
      "Never call Serial, delay() or Wire inside an interrupt handler.",
      "Mark interrupt handlers IRAM_ATTR.",
    ],
    related: ["task-watchdog-got-triggered", "cache-disabled-but-cached-memory-region-accessed", "watchdog-reset-tg0wdt-sys-reset"],
    keys: ["panic-intwdt"],
  },
  {
    slug: "cache-disabled-but-cached-memory-region-accessed",
    title: "Cache disabled but cached memory region accessed",
    group: "crash",
    match: "Guru Meditation Error: Core  0 panic'ed (Cache disabled but cached memory region accessed).",
    example: ["Guru Meditation Error: Core  0 panic'ed (Cache disabled but cached memory region accessed)."],
    means:
      "An interrupt ran while the flash cache was turned off, which happens while flash is being written (Preferences, LittleFS, SPIFFS, OTA). The handler, or something it called or read, lives in flash, so it could not be fetched.",
    causes: [
      "An interrupt handler without IRAM_ATTR.",
      "A handler that calls a function without IRAM_ATTR.",
      "A handler that reads a const table, which is stored in flash.",
    ],
    fixes: [
      "Mark the handler and every function it calls IRAM_ATTR.",
      "Move constant data the handler reads into RAM: drop const or copy it to a RAM buffer at start-up.",
      "Do as little as possible in the handler: set a flag and return.",
    ],
    related: ["interrupt-wdt-timeout", "decode-esp32-backtrace"],
    keys: ["panic-cache"],
  },
  {
    slug: "task-watchdog-got-triggered",
    title: "Task watchdog got triggered. The following tasks did not reset the watchdog in time",
    group: "crash",
    match: "E (10321) task_wdt: Task watchdog got triggered. The following tasks did not reset the watchdog in time:",
    example: [
      "E (10321) task_wdt: Task watchdog got triggered. The following tasks did not reset the watchdog in time:",
      "E (10321) task_wdt:  - IDLE0 (CPU 0)",
      "E (10321) task_wdt: Tasks currently running:",
      "E (10321) task_wdt: CPU 0: loopTask",
    ],
    means:
      "A task ran for several seconds without giving the CPU back. The task named after the dash is the one that got starved: IDLE0 or IDLE1 means something on that core never yielded, so the idle task could not run.",
    causes: [
      "A wait loop with no delay, such as while (!client.available()) {}.",
      "A long computation or a big for loop in loop() with no delay().",
      "A task pinned to core 0 that never blocks, starving Wi-Fi and the idle task.",
    ],
    fixes: [
      "Put delay(1) or yield() inside every loop that waits for something.",
      "Add a timeout to wait loops so they give up instead of spinning forever.",
      "In your own tasks, block with vTaskDelay(), a queue or a semaphore instead of polling.",
    ],
    related: ["interrupt-wdt-timeout", "watchdog-reset-tg0wdt-sys-reset"],
    keys: ["taskwdt"],
  },
  {
    slug: "abort-was-called",
    title: "abort() was called at PC 0x... on core 1",
    group: "crash",
    match: "abort() was called at PC 0x400d5c2b on core 1",
    example: [
      "assert failed: xQueueSemaphoreTake queue.c:1545 (( pxQueue ))",
      "abort() was called at PC 0x400d5c2b on core 1",
      "Backtrace: 0x40083a85:0x3ffb1e20 0x4008d6a1:0x3ffb1e40 0x400d5c2b:0x3ffb1e60",
    ],
    means:
      "The firmware stopped itself on purpose. Something detected an impossible state and chose to crash rather than continue. The line just above abort() usually says what: an assert, a heap check, an uncaught C++ exception or an ESP_ERROR_CHECK failure.",
    causes: [
      "A failed assert in ESP-IDF or a library (see the assert failed page).",
      "ESP_ERROR_CHECK on a call that returned an error.",
      "An uncaught C++ exception, such as std::bad_alloc when memory runs out.",
      "Heap corruption detected by the allocator.",
    ],
    fixes: [
      "Read the line above abort(): it names the check that failed.",
      "Decode the backtrace to see which of your functions led there.",
      "Check free memory with ESP.getFreeHeap() if the abort comes from an allocation.",
    ],
    related: ["assert-failed", "corrupt-heap", "decode-esp32-backtrace"],
    keys: ["abort", "assert", "backtrace"],
  },
  {
    slug: "stack-smashing-protect-failure",
    title: "Stack smashing protect failure!",
    group: "crash",
    match: "Stack smashing protect failure!",
    example: ["Stack smashing protect failure!", "", "abort() was called at PC 0x400d1b2f on core 1"],
    means:
      "A function wrote past the end of one of its local arrays and damaged the guard value the compiler places after it. The check runs when the function returns, so the culprit is the function named at the top of the backtrace.",
    causes: [
      "sprintf or strcpy into a local char buffer that is too small.",
      "An array index that reaches the array's length.",
      "memcpy or read() with a length larger than the destination.",
    ],
    fixes: [
      "Use snprintf(buf, sizeof buf, ...) and strlcpy instead of sprintf and strcpy.",
      "Check loop bounds use < length, not <= length.",
      "Make the buffer larger, or move it off the stack.",
    ],
    related: ["stack-canary-watchpoint", "abort-was-called", "corrupt-heap"],
    keys: ["smash", "abort"],
  },
  {
    slug: "corrupt-heap",
    title: "CORRUPT HEAP: Bad head at 0x... Expected 0xabba1234",
    group: "crash",
    match: "CORRUPT HEAP: Bad head at 0x3ffb8f2c. Expected 0xabba1234 got 0x3ffb8f40",
    example: [
      "CORRUPT HEAP: Bad head at 0x3ffb8f2c. Expected 0xabba1234 got 0x3ffb8f40",
      "assert failed: multi_heap_free multi_heap_poisoning.c:259 (head != NULL)",
    ],
    means:
      "The heap allocator found its own bookkeeping overwritten. Some earlier code wrote outside a block it allocated, or used a block after freeing it. The crash is reported at the next malloc or free, which is usually far from the real bug.",
    causes: [
      "Writing past the end of a buffer from malloc() or new[].",
      "Freeing the same pointer twice, or using it after free() or delete.",
      "Two tasks modifying the same String, vector or buffer at once.",
    ],
    fixes: [
      "Call heap_caps_check_integrity_all(true) at points in your code to narrow down where the damage happens.",
      "Check every write into heap buffers for length.",
      "Protect data shared between tasks with a mutex.",
    ],
    related: ["guru-meditation-storeprohibited", "abort-was-called", "assert-failed"],
    keys: ["heap", "assert"],
  },
  {
    slug: "assert-failed",
    title: "assert failed: xQueueSemaphoreTake queue.c (( pxQueue ))",
    group: "crash",
    match: "assert failed: xQueueSemaphoreTake queue.c:1545 (( pxQueue ))",
    example: ["assert failed: xQueueSemaphoreTake queue.c:1545 (( pxQueue ))"],
    means:
      "A sanity check failed. The line reads: assert failed: <function> <file>:<line> (<condition>). The condition is what should have been true. This common example means a mutex or semaphore was used before it was created.",
    causes: [
      "Taking a semaphore or mutex whose xSemaphoreCreate... call has not run yet, or failed.",
      "Calling a FreeRTOS API that blocks from inside an interrupt handler.",
      "Heap corruption tripping an allocator check (multi_heap_... in the function name).",
    ],
    fixes: [
      "Read the condition in brackets: it says exactly what was wrong.",
      "Create semaphores, queues and mutexes in setup() before starting any task that uses them.",
      "Use the ...FromISR variants of FreeRTOS calls inside interrupt handlers.",
    ],
    related: ["abort-was-called", "corrupt-heap"],
    keys: ["assert"],
  },
  {
    slug: "decode-esp32-backtrace",
    title: "How to decode an ESP32 Backtrace",
    group: "crash",
    match: "Backtrace: 0x400d1a2b:0x3ffb1f10 0x400d2c3d:0x3ffb1f30",
    example: ["Backtrace: 0x400d1a2b:0x3ffb1f10 0x400d2c3d:0x3ffb1f30 0x400d8f4e:0x3ffb1f50"],
    means:
      "Each pair is a program counter and a stack pointer. The first address in each pair names a place in your firmware; read together they are the chain of calls that led to the crash, newest first. They only become file names and line numbers with the .elf file from the same build.",
    causes: ["A backtrace follows every panic, abort and assert. It is the clue, not the problem."],
    fixes: [
      "Arduino IDE 2: install the \"ESP Exception Decoder\" extension, paste the backtrace into it, and it uses the sketch's last build.",
      "PlatformIO: add monitor_filters = esp32_exception_decoder to platformio.ini and the monitor decodes automatically.",
      "By hand: xtensa-esp32-elf-addr2line -pfiaC -e firmware.elf 0x400d1a2b 0x400d2c3d (use riscv32-esp-elf-addr2line for the ESP32-C3).",
      "The .elf must come from exactly the build that is on the board; rebuild and reflash if unsure.",
    ],
    related: ["guru-meditation-loadprohibited", "abort-was-called"],
    keys: ["backtrace"],
  },

  // Resets and power
  {
    slug: "brownout-detector-was-triggered",
    title: "Brownout detector was triggered",
    group: "reset",
    match: "Brownout detector was triggered",
    example: ["Brownout detector was triggered", "", "ets Jun  8 2016 00:22:57", "rst:0xc (SW_CPU_RESET),boot:0x13 (SPI_FAST_FLASH_BOOT)"],
    means:
      "The 3.3 V supply dipped below the safe level and the chip reset itself to avoid corrupting flash. It almost always happens when Wi-Fi or Bluetooth starts, because the radio draws bursts of several hundred milliamps.",
    causes: [
      "A long or thin USB cable, or an unpowered USB hub.",
      "A weak 3.3 V regulator on a cheap board, or a battery that is nearly flat.",
      "Motors, LED strips or servos powered from the same 3.3 V or 5 V pin.",
    ],
    fixes: [
      "Use a short, good USB cable plugged straight into the computer or a powered hub.",
      "Put a 100 µF to 470 µF capacitor across 3V3 and GND, close to the board.",
      "Power motors and LED strips from their own supply, sharing only ground.",
      "Lower the Wi-Fi transmit power with WiFi.setTxPower(WIFI_POWER_8_5dBm) after WiFi.begin().",
      "Disabling the brownout detector hides the symptom and risks flash corruption; fix the power instead.",
    ],
    related: ["sw-cpu-reset", "rtcwdt-rtc-reset"],
    keys: ["brownout", "rst-SW_CPU_RESET"],
  },
  {
    slug: "sw-cpu-reset",
    title: "rst:0xc (SW_CPU_RESET)",
    group: "reset",
    match: "rst:0xc (SW_CPU_RESET),boot:0x13 (SPI_FAST_FLASH_BOOT)",
    example: ["ets Jun  8 2016 00:22:57", "", "rst:0xc (SW_CPU_RESET),boot:0x13 (SPI_FAST_FLASH_BOOT)"],
    means:
      "The firmware restarted the chip itself. That is either a deliberate ESP.restart() or the panic handler restarting after a crash. If you did not call ESP.restart(), scroll up: the crash message is just above this line.",
    causes: [
      "A Guru Meditation error, abort or assert, followed by the automatic restart.",
      "A brownout on boards that report it as a software reset.",
      "Code or a library calling ESP.restart(), for example after a failed Wi-Fi connection.",
    ],
    fixes: [
      "Read the lines above the reset; that is where the reason is.",
      "Call esp_reset_reason() in setup() and print it to log the cause of the last reset.",
    ],
    related: ["guru-meditation-loadprohibited", "brownout-detector-was-triggered", "watchdog-reset-tg0wdt-sys-reset"],
    keys: ["rst-SW_CPU_RESET"],
  },
  {
    slug: "watchdog-reset-tg0wdt-sys-reset",
    title: "rst:0x7 (TG0WDT_SYS_RESET) and rst:0x8 (TG1WDT_SYS_RESET)",
    group: "reset",
    match: "rst:0x7 (TG0WDT_SYS_RESET),boot:0x13 (SPI_FAST_FLASH_BOOT)",
    example: [
      "rst:0x7 (TG0WDT_SYS_RESET),boot:0x13 (SPI_FAST_FLASH_BOOT)",
      "rst:0x8 (TG1WDT_SYS_RESET),boot:0x13 (SPI_FAST_FLASH_BOOT)",
    ],
    means:
      "A hardware watchdog timer reset the whole chip because the code stopped responding. TG0 is usually the task watchdog side, TG1 the interrupt watchdog. Unlike a panic, there may be no crash message before it.",
    causes: [
      "A task or loop that never yields, so the watchdog is never fed.",
      "Interrupts blocked for too long.",
      "A deadlock: two tasks each waiting for a lock the other holds.",
    ],
    fixes: [
      "Add delay(1) or yield() to long loops and timeouts to wait loops.",
      "Keep interrupt handlers short and never block inside them.",
      "Take locks in the same order everywhere to avoid deadlocks.",
    ],
    related: ["task-watchdog-got-triggered", "interrupt-wdt-timeout"],
    keys: ["rst-TG0WDT_SYS_RESET", "rst-TG1WDT_SYS_RESET"],
  },
  {
    slug: "rtcwdt-rtc-reset",
    title: "rst:0x10 (RTCWDT_RTC_RESET) boot loop",
    group: "reset",
    match: "rst:0x10 (RTCWDT_RTC_RESET),boot:0x33 (SPI_FAST_FLASH_BOOT)",
    example: ["rst:0x10 (RTCWDT_RTC_RESET),boot:0x33 (SPI_FAST_FLASH_BOOT)", "flash read err, 1000"],
    means:
      "The low-level RTC watchdog reset the chip, usually because it could not get through boot. Repeated over and over, it is a boot loop that happens before your sketch runs.",
    causes: [
      "Something wired to GPIO 12 on the classic ESP32 holding it high at reset, which sets the wrong flash voltage.",
      "Unstable power during boot.",
      "Corrupted or wrongly flashed firmware.",
    ],
    fixes: [
      "Disconnect everything except USB and reset. If it boots, add parts back one at a time.",
      "Keep GPIO 12 free on the classic ESP32, or make sure nothing pulls it high at reset.",
      "Erase the flash and flash again.",
    ],
    related: ["flash-read-err", "brownout-detector-was-triggered", "invalid-header"],
    keys: ["rst-RTCWDT_RTC_RESET", "flashread"],
  },
  {
    slug: "deepsleep-reset",
    title: "rst:0x5 (DEEPSLEEP_RESET)",
    group: "reset",
    match: "rst:0x5 (DEEPSLEEP_RESET),boot:0x13 (SPI_FAST_FLASH_BOOT)",
    example: ["rst:0x5 (DEEPSLEEP_RESET),boot:0x13 (SPI_FAST_FLASH_BOOT)"],
    means:
      "The chip woke from deep sleep. That is normal, but deep sleep turns off the CPU and RAM, so waking is a full restart: setup() runs again and ordinary variables are back to their starting values.",
    causes: ["A timer, button (ext0/ext1), touch or ULP wake-up from esp_deep_sleep_start()."],
    fixes: [
      "Use esp_sleep_get_wakeup_cause() in setup() to tell a wake-up from a power-on.",
      "Keep values across sleeps in variables marked RTC_DATA_ATTR.",
    ],
    related: ["sw-cpu-reset"],
    keys: ["rst-DEEPSLEEP_RESET"],
  },
  {
    slug: "usb-uart-chip-reset",
    title: "rst:0x15 (USB_UART_CHIP_RESET)",
    group: "reset",
    match: "rst:0x15 (USB_UART_CHIP_RESET),boot:0x8 (SPI_FAST_FLASH_BOOT)",
    example: ["ESP-ROM:esp32s3-20210327", "rst:0x15 (USB_UART_CHIP_RESET),boot:0x8 (SPI_FAST_FLASH_BOOT)"],
    means:
      "The chip was reset through its built-in USB port. On the ESP32-S3, C3 and C6, opening the native USB serial port from a serial monitor or the bench can reset the board. It is normal and not a crash.",
    causes: ["Opening or reconnecting the serial monitor on the native USB port.", "An upload tool resetting the board."],
    fixes: [
      "Nothing to fix. Do not read a restart counter or short uptime on this port as evidence of a crash.",
      "Use the board's UART USB port, if it has one, when you need to watch it without resetting.",
    ],
    related: ["sw-cpu-reset"],
    keys: ["rst-USB_UART_CHIP_RESET"],
  },

  // Boot and flash
  {
    slug: "waiting-for-download",
    title: "waiting for download (boot:0x3 DOWNLOAD_BOOT)",
    group: "boot",
    match: "waiting for download",
    example: ["rst:0x1 (POWERON_RESET),boot:0x3 (DOWNLOAD_BOOT(UART0/UART1/SDIO_REI_REO_V2))", "waiting for download"],
    means:
      "The chip started in download mode and is waiting for new firmware instead of running the one it has. It does this when GPIO 0 (GPIO 9 on the C3, GPIO 0 on the S3) is low at reset.",
    causes: [
      "The BOOT button was held, or is stuck.",
      "A part wired to GPIO 0 (or GPIO 9 on the C3) pulls it low at reset.",
      "The board was left in download mode after a manual upload.",
    ],
    fixes: [
      "Press EN or RST once, without holding BOOT.",
      "Move parts off the boot strapping pin, or make sure they cannot pull it low during reset.",
    ],
    related: ["failed-to-connect-no-serial-data-received", "invalid-header"],
    keys: ["download"],
  },
  {
    slug: "invalid-header",
    title: "invalid header: 0xffffffff",
    group: "boot",
    match: "invalid header: 0xffffffff",
    example: ["rst:0x1 (POWERON_RESET),boot:0x13 (SPI_FAST_FLASH_BOOT)", "invalid header: 0xffffffff", "invalid header: 0xffffffff"],
    means:
      "The bootloader looked for firmware and found none it could use. 0xffffffff is erased flash. The message repeats because the ROM keeps retrying.",
    causes: [
      "The flash is empty, for example after an erase or a failed upload.",
      "A .bin written at the wrong offset, such as an application image written at 0x0 instead of 0x10000.",
      "A flash mode or size setting that does not match the board.",
    ],
    fixes: [
      "Upload again from the Arduino IDE, or flash the merged image at offset 0x0 with esptool.",
      "When flashing by hand, write the bootloader, partition table and app at their own offsets, or use a merged binary at 0x0.",
      "Try Tools > Flash Mode: DIO if QIO does not boot.",
    ],
    related: ["flash-read-err", "waiting-for-download", "rtcwdt-rtc-reset"],
    keys: ["header"],
  },
  {
    slug: "flash-read-err",
    title: "flash read err, 1000",
    group: "boot",
    match: "flash read err, 1000",
    example: ["rst:0x10 (RTCWDT_RTC_RESET),boot:0x13 (SPI_FAST_FLASH_BOOT)", "flash read err, 1000"],
    means:
      "The bootloader could not read the flash chip at offset 0x1000, where the second-stage bootloader lives on the classic ESP32. Either the flash is not powered correctly or it was set up with the wrong mode.",
    causes: [
      "GPIO 12 pulled high at reset on the classic ESP32, which selects 1.8 V flash on a 3.3 V flash chip.",
      "Wrong flash mode or frequency in the upload settings.",
      "A damaged flash chip, which is rare.",
    ],
    fixes: [
      "Disconnect whatever is on GPIO 12 and reset.",
      "Set Tools > Flash Mode to DIO and Flash Frequency to 40 MHz, then upload again.",
      "If GPIO 12 must be used, burn the flash voltage eFuse with espefuse.py set_flash_voltage 3.3V. That is permanent, so be sure of your flash chip's voltage first.",
    ],
    related: ["rtcwdt-rtc-reset", "invalid-header"],
    keys: ["flashread"],
  },

  // Upload and connection
  {
    slug: "failed-to-connect-no-serial-data-received",
    title: "A fatal error occurred: Failed to connect to ESP32: No serial data received",
    group: "upload",
    match: "A fatal error occurred: Failed to connect to ESP32: No serial data received.",
    example: [
      "esptool.py v4.6",
      "Serial port /dev/ttyUSB0",
      "Connecting......................................",
      "",
      "A fatal error occurred: Failed to connect to ESP32: No serial data received.",
      "For troubleshooting steps visit: https://docs.espressif.com/projects/esptool/en/latest/troubleshooting.html",
    ],
    means:
      "esptool opened the serial port but the chip never answered. The board did not enter download mode, so the bootloader never listened.",
    causes: [
      "The board's auto-reset circuit did not put it in download mode. Common on some cheap boards.",
      "A long, thin or worn USB cable that drops data or lets the voltage sag while the chip resets.",
      "A part on GPIO 0, GPIO 2 or GPIO 12 holding a strapping pin the wrong way.",
    ],
    fixes: [
      "Hold BOOT, press and release EN or RST, then release BOOT and upload again. Or hold BOOT while \"Connecting...\" is printed.",
      "Try another USB cable that you know carries data.",
      "Lower Tools > Upload Speed to 115200.",
      "Disconnect parts from the strapping pins and try again.",
      "Put a 10 µF capacitor between EN and GND if your board never enters download mode by itself.",
    ],
    related: ["timed-out-waiting-for-packet-header", "could-not-open-port", "waiting-for-download"],
  },
  {
    slug: "timed-out-waiting-for-packet-header",
    title: "Failed to connect to ESP32: Timed out waiting for packet header",
    group: "upload",
    match: "A fatal error occurred: Failed to connect to ESP32: Timed out waiting for packet header",
    example: [
      "Connecting........_____....._____....._____",
      "A fatal error occurred: Failed to connect to ESP32: Timed out waiting for packet header",
    ],
    means:
      "esptool got some data from the port but not a valid reply from the bootloader. It is the older wording of the same problem as \"No serial data received\": the chip is not in download mode, or the link is unreliable.",
    causes: [
      "The board did not enter download mode.",
      "Upload speed too high for the cable or USB bridge.",
      "Another program, such as a serial monitor or a browser tab with the bench open, holding the port.",
    ],
    fixes: [
      "Hold BOOT while uploading, then press EN when it finishes.",
      "Close every serial monitor, including the bench page, before uploading.",
      "Lower Tools > Upload Speed to 115200.",
    ],
    related: ["failed-to-connect-no-serial-data-received", "could-not-open-port"],
  },
  {
    slug: "could-not-open-port",
    title: "Could not open /dev/ttyUSB0, the port is busy or doesn't exist",
    group: "upload",
    match: "A fatal error occurred: Could not open /dev/ttyUSB0, the port is busy or doesn't exist.",
    example: [
      "A fatal error occurred: Could not open /dev/ttyUSB0, the port is busy or doesn't exist.",
      "([Errno 13] could not open port /dev/ttyUSB0: [Errno 13] Permission denied: '/dev/ttyUSB0')",
    ],
    means:
      "The upload tool could not open the serial port. The text in brackets says why: Permission denied is an access problem, Device or resource busy means another program has the port, and No such file means the board is not seen at all.",
    causes: [
      "On Linux, your user is not in the group that owns serial ports.",
      "A serial monitor, the bench page or another IDE has the port open.",
      "The board was unplugged or appeared under another name, such as /dev/ttyACM0 or COM4.",
      "A missing USB-to-serial driver (CP210x or CH340) on Windows or macOS.",
    ],
    fixes: [
      "Linux: sudo usermod -aG dialout $USER on Debian and Ubuntu (uucp on Arch), then log out and back in.",
      "Close other serial monitors and disconnect the bench page before uploading.",
      "Pick the port again in Tools > Port after replugging.",
      "Install the CP210x or CH340 driver for the bridge chip on your board.",
    ],
    related: ["failed-to-connect-no-serial-data-received", "timed-out-waiting-for-packet-header"],
  },
  {
    slug: "sketch-too-big",
    title: "Sketch too big: text section exceeds available space in board",
    group: "upload",
    match: "Sketch too big; see https://support.arduino.cc/hc/en-us/articles/360013825179 for tips on reducing it.",
    example: [
      "Sketch uses 1402386 bytes (107%) of program storage space. Maximum is 1310720 bytes.",
      "Sketch too big; see https://support.arduino.cc/hc/en-us/articles/360013825179 for tips on reducing it.",
      "text section exceeds available space in board",
    ],
    means:
      "The compiled firmware is larger than the app partition. The default partition scheme gives each app 1.25 MB so that there is room for over-the-air updates; Wi-Fi plus Bluetooth plus TLS can exceed it.",
    causes: [
      "Using Wi-Fi and Bluetooth in the same sketch.",
      "Large libraries, fonts or images compiled into the firmware.",
      "The default partition scheme reserving space for OTA.",
    ],
    fixes: [
      "Pick a bigger app partition in Tools > Partition Scheme, such as \"Huge APP (3MB No OTA/1MB SPIFFS)\". You lose OTA updates.",
      "On boards with more flash, set Tools > Flash Size to match and pick a matching scheme.",
      "Drop libraries you do not use, and move fonts or images into LittleFS.",
    ],
    related: ["invalid-header"],
  },
];

export const errorBySlug = (slug: string): ErrorEntry | undefined => ERRORS.find((e) => e.slug === slug);

/** The reference page for a crash.ts finding key, if there is one. */
export function errorSlugForKey(key: string): string | undefined {
  // Prefer the entry whose first key is this one, so "backtrace" maps to the backtrace page.
  return (ERRORS.find((e) => e.keys?.[0] === key) ?? ERRORS.find((e) => e.keys?.includes(key)))?.slug;
}

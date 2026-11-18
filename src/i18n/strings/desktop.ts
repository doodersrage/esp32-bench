// The desktop app: its page (/desktop/) and the "Open in the desktop app" link on
// project pages. The app's version and links are in DESKTOP (src/lib/site.ts).
import { defineStrings } from "../t";

export const DESKTOP_STRINGS = defineStrings({
  en: {
    title: "Desktop app for Linux",
    description:
      "ESP32 Bench as a desktop app for Arch Linux with KDE Plasma: build, flash, monitor and simulate the project library's sketches on your computer.",
    h1: "ESP32 Bench for Linux",
    lede: "The same project library as a desktop app: build, flash and simulate projects on your computer, without a browser. It is new, and for Arch Linux with KDE Plasma only.",
    doesH: "What it does",
    doesBuild: "Builds library projects with arduino-cli, and asks before it builds or flashes anything it downloaded.",
    doesFlash: "Flashes, inspects and monitors boards over USB, without root.",
    doesSim:
      "Runs ESP32, ESP32-S3 and ESP32-C3 builds in a simulator, with a serial console, a debugger and virtual parts: LEDs, buttons, a NeoPixel strip, an OLED and I2C sensors.",
    doesWifi:
      "Gives simulated sketches a Wi-Fi network that reaches nothing outside: they get an address, and their web pages open on your computer.",
    limitsH: "What it does not do",
    limitsPlatform: "It runs only on Arch Linux with KDE Plasma for now: not on Windows, macOS or other Linux distributions.",
    limitsSim:
      "The simulator runs the firmware, not the electronics: there is no Bluetooth, analog inputs read 0, and the ESP32-S3 has no Wi-Fi.",
    limitsReset:
      "Resetting boards with a CP210x or CH340 USB chip into flashing mode has not been tested on hardware yet. If flashing fails, hold BOOT while it starts.",
    installH: "Install it",
    install: "Download the package from the latest release ({version}) and install it with pacman:",
    installAfter:
      "Then open ESP32 Bench from the launcher. The first time, Tools, then Toolchain setup, installs the build tools and builds the simulator, which takes a while.",
    openH: "Opening projects from this site",
    open:
      "Project pages have an Open in the desktop app link. With the app installed, it opens the project there, and nothing is built until you agree. Without the app, your browser cannot follow the link.",
    sourceH: "Source and problems",
    source: "The app is free software (GPL-2.0-or-later). Source code, releases and problem reports are on {repo}.",
    openLink: "Open in the desktop app",
    openLinkTitle: "Opens this project in ESP32 Bench for Linux, if the app is installed",
    whatIsThis: "What is this?",
    footLink: "Desktop app",
  },
  es: {
    title: "App de escritorio para Linux",
    description:
      "ESP32 Bench como app de escritorio para Arch Linux con KDE Plasma: compila, graba, monitoriza y simula los sketches de la biblioteca de proyectos en tu ordenador.",
    h1: "ESP32 Bench para Linux",
    lede: "La misma biblioteca de proyectos como app de escritorio: compila, graba y simula proyectos en tu ordenador, sin navegador. Es nueva y solo funciona en Arch Linux con KDE Plasma.",
    doesH: "Qué hace",
    doesBuild: "Compila los proyectos de la biblioteca con arduino-cli y pregunta antes de compilar o grabar cualquier cosa descargada.",
    doesFlash: "Graba, inspecciona y monitoriza placas por USB, sin root.",
    doesSim:
      "Ejecuta compilaciones para ESP32, ESP32-S3 y ESP32-C3 en un simulador, con consola serie, depurador y piezas virtuales: LED, botones, una tira NeoPixel, una pantalla OLED y sensores I2C.",
    doesWifi:
      "Da a los sketches simulados una red Wi-Fi que no llega a nada externo: reciben una dirección y sus páginas web se abren en tu ordenador.",
    limitsH: "Qué no hace",
    limitsPlatform: "Por ahora solo funciona en Arch Linux con KDE Plasma: no en Windows, macOS ni otras distribuciones de Linux.",
    limitsSim:
      "El simulador ejecuta el firmware, no la electrónica: no hay Bluetooth, las entradas analógicas leen 0 y el ESP32-S3 no tiene Wi-Fi.",
    limitsReset:
      "El reinicio en modo de grabación de placas con chip USB CP210x o CH340 aún no se ha probado con hardware. Si la grabación falla, mantén pulsado BOOT mientras empieza.",
    installH: "Instálala",
    install: "Descarga el paquete de la última versión ({version}) e instálalo con pacman:",
    installAfter:
      "Luego abre ESP32 Bench desde el lanzador. La primera vez, Tools y después Toolchain setup instala las herramientas de compilación y compila el simulador, lo que tarda un rato.",
    openH: "Abrir proyectos desde este sitio",
    open:
      "Las páginas de proyecto tienen un enlace Abrir en la app de escritorio. Con la app instalada, abre el proyecto allí, y no se compila nada hasta que aceptes. Sin la app, tu navegador no puede seguir el enlace.",
    sourceH: "Código fuente y problemas",
    source: "La app es software libre (GPL-2.0-or-later). El código fuente, las versiones y los informes de problemas están en {repo}.",
    openLink: "Abrir en la app de escritorio",
    openLinkTitle: "Abre este proyecto en ESP32 Bench para Linux, si la app está instalada",
    whatIsThis: "¿Qué es esto?",
    footLink: "App de escritorio",
  },
  de: {
    title: "Desktop-App für Linux",
    description:
      "ESP32 Bench als Desktop-App für Arch Linux mit KDE Plasma: Sketches der Projektbibliothek auf deinem Rechner kompilieren, flashen, überwachen und simulieren.",
    h1: "ESP32 Bench für Linux",
    lede: "Dieselbe Projektbibliothek als Desktop-App: Projekte auf deinem Rechner kompilieren, flashen und simulieren, ohne Browser. Sie ist neu und läuft nur unter Arch Linux mit KDE Plasma.",
    doesH: "Was sie kann",
    doesBuild: "Kompiliert Projekte der Bibliothek mit arduino-cli und fragt nach, bevor sie etwas Heruntergeladenes kompiliert oder flasht.",
    doesFlash: "Flasht, untersucht und überwacht Boards über USB, ohne root.",
    doesSim:
      "Führt Builds für ESP32, ESP32-S3 und ESP32-C3 in einem Simulator aus, mit serieller Konsole, Debugger und virtuellen Bauteilen: LEDs, Taster, ein NeoPixel-Streifen, ein OLED und I2C-Sensoren.",
    doesWifi:
      "Gibt simulierten Sketches ein WLAN, das nichts außerhalb erreicht: Sie bekommen eine Adresse, und ihre Webseiten öffnen sich auf deinem Rechner.",
    limitsH: "Was sie nicht kann",
    limitsPlatform: "Sie läuft vorerst nur unter Arch Linux mit KDE Plasma: nicht unter Windows, macOS oder anderen Linux-Distributionen.",
    limitsSim:
      "Der Simulator führt die Firmware aus, nicht die Elektronik: kein Bluetooth, analoge Eingänge lesen 0, und der ESP32-S3 hat kein WLAN.",
    limitsReset:
      "Das Zurücksetzen in den Flash-Modus bei Boards mit CP210x- oder CH340-USB-Chip ist noch nicht an echter Hardware getestet. Wenn das Flashen fehlschlägt, halte beim Start BOOT gedrückt.",
    installH: "Installieren",
    install: "Lade das Paket aus der neuesten Version ({version}) herunter und installiere es mit pacman:",
    installAfter:
      "Öffne dann ESP32 Bench aus dem Startmenü. Beim ersten Mal installiert Tools, dann Toolchain setup, die Build-Werkzeuge und baut den Simulator; das dauert eine Weile.",
    openH: "Projekte von dieser Seite öffnen",
    open:
      "Projektseiten haben einen Link In der Desktop-App öffnen. Ist die App installiert, öffnet er das Projekt dort, und nichts wird kompiliert, bevor du zustimmst. Ohne die App kann dein Browser dem Link nicht folgen.",
    sourceH: "Quellcode und Probleme",
    source: "Die App ist freie Software (GPL-2.0-or-later). Quellcode, Versionen und Fehlerberichte findest du auf {repo}.",
    openLink: "In der Desktop-App öffnen",
    openLinkTitle: "Öffnet dieses Projekt in ESP32 Bench für Linux, falls die App installiert ist",
    whatIsThis: "Was ist das?",
    footLink: "Desktop-App",
  },
  fr: {
    title: "Application de bureau pour Linux",
    description:
      "ESP32 Bench en application de bureau pour Arch Linux avec KDE Plasma : compilez, flashez, surveillez et simulez les sketches de la bibliothèque de projets sur votre ordinateur.",
    h1: "ESP32 Bench pour Linux",
    lede: "La même bibliothèque de projets en application de bureau : compilez, flashez et simulez des projets sur votre ordinateur, sans navigateur. Elle est nouvelle et ne fonctionne que sous Arch Linux avec KDE Plasma.",
    doesH: "Ce qu'elle fait",
    doesBuild: "Compile les projets de la bibliothèque avec arduino-cli et demande avant de compiler ou de flasher tout ce qui a été téléchargé.",
    doesFlash: "Flashe, inspecte et surveille les cartes par USB, sans root.",
    doesSim:
      "Exécute les compilations pour ESP32, ESP32-S3 et ESP32-C3 dans un simulateur, avec une console série, un débogueur et des composants virtuels : LED, boutons, un ruban NeoPixel, un écran OLED et des capteurs I2C.",
    doesWifi:
      "Donne aux sketches simulés un réseau Wi-Fi qui n'atteint rien à l'extérieur : ils reçoivent une adresse, et leurs pages web s'ouvrent sur votre ordinateur.",
    limitsH: "Ce qu'elle ne fait pas",
    limitsPlatform: "Pour l'instant, elle ne fonctionne que sous Arch Linux avec KDE Plasma : ni Windows, ni macOS, ni d'autres distributions Linux.",
    limitsSim:
      "Le simulateur exécute le firmware, pas l'électronique : pas de Bluetooth, les entrées analogiques lisent 0, et l'ESP32-S3 n'a pas de Wi-Fi.",
    limitsReset:
      "Le passage en mode flash des cartes avec une puce USB CP210x ou CH340 n'a pas encore été testé sur du matériel. Si le flash échoue, maintenez BOOT pendant le démarrage.",
    installH: "L'installer",
    install: "Téléchargez le paquet de la dernière version ({version}) et installez-le avec pacman :",
    installAfter:
      "Ouvrez ensuite ESP32 Bench depuis le lanceur. La première fois, Tools, puis Toolchain setup, installe les outils de compilation et compile le simulateur, ce qui prend un moment.",
    openH: "Ouvrir des projets depuis ce site",
    open:
      "Les pages de projet ont un lien Ouvrir dans l'application de bureau. Si l'application est installée, il y ouvre le projet, et rien n'est compilé avant votre accord. Sans l'application, votre navigateur ne peut pas suivre le lien.",
    sourceH: "Code source et problèmes",
    source: "L'application est un logiciel libre (GPL-2.0-or-later). Le code source, les versions et les signalements de problèmes sont sur {repo}.",
    openLink: "Ouvrir dans l'application de bureau",
    openLinkTitle: "Ouvre ce projet dans ESP32 Bench pour Linux, si l'application est installée",
    whatIsThis: "Qu'est-ce que c'est ?",
    footLink: "Application de bureau",
  },
  "pt-br": {
    title: "App de desktop para Linux",
    description:
      "ESP32 Bench como app de desktop para Arch Linux com KDE Plasma: compile, grave, monitore e simule os sketches da biblioteca de projetos no seu computador.",
    h1: "ESP32 Bench para Linux",
    lede: "A mesma biblioteca de projetos como app de desktop: compile, grave e simule projetos no seu computador, sem navegador. Ele é novo e funciona só no Arch Linux com KDE Plasma.",
    doesH: "O que ele faz",
    doesBuild: "Compila os projetos da biblioteca com arduino-cli e pergunta antes de compilar ou gravar qualquer coisa baixada.",
    doesFlash: "Grava, inspeciona e monitora placas pela USB, sem root.",
    doesSim:
      "Roda compilações para ESP32, ESP32-S3 e ESP32-C3 em um simulador, com console serial, depurador e peças virtuais: LEDs, botões, uma fita NeoPixel, um display OLED e sensores I2C.",
    doesWifi:
      "Dá aos sketches simulados uma rede Wi-Fi que não alcança nada lá fora: eles recebem um endereço, e suas páginas web abrem no seu computador.",
    limitsH: "O que ele não faz",
    limitsPlatform: "Por enquanto ele roda só no Arch Linux com KDE Plasma: não no Windows, no macOS nem em outras distribuições Linux.",
    limitsSim:
      "O simulador roda o firmware, não a eletrônica: não há Bluetooth, entradas analógicas leem 0 e o ESP32-S3 não tem Wi-Fi.",
    limitsReset:
      "Reiniciar no modo de gravação placas com chip USB CP210x ou CH340 ainda não foi testado em hardware. Se a gravação falhar, segure BOOT enquanto ela começa.",
    installH: "Instale",
    install: "Baixe o pacote da versão mais recente ({version}) e instale com o pacman:",
    installAfter:
      "Depois abra o ESP32 Bench pelo menu de aplicativos. Na primeira vez, Tools e depois Toolchain setup instala as ferramentas de compilação e compila o simulador, o que leva um tempo.",
    openH: "Abrir projetos a partir deste site",
    open:
      "As páginas de projeto têm um link Abrir no app de desktop. Com o app instalado, ele abre o projeto lá, e nada é compilado até você concordar. Sem o app, seu navegador não consegue seguir o link.",
    sourceH: "Código-fonte e problemas",
    source: "O app é software livre (GPL-2.0-or-later). Código-fonte, versões e relatos de problemas ficam em {repo}.",
    openLink: "Abrir no app de desktop",
    openLinkTitle: "Abre este projeto no ESP32 Bench para Linux, se o app estiver instalado",
    whatIsThis: "O que é isto?",
    footLink: "App de desktop",
  },
});

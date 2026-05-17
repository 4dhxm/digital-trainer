"use client";

import {
  createContext,
  forwardRef,
  PointerEvent,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

type GateType =
  | "NAND"
  | "NOR"
  | "NOT"
  | "AND"
  | "OR"
  | "XOR"
  | "NAND3"
  | "NAND4"
  | "DECODER7442"
  | "SEG7447"
  | "LATCH7475"
  | "ADDER7483"
  | "COMP7485"
  | "COUNTER7490"
  | "COUNTER74393"
  | "JK7473"
  | "D7474"
  | "TIMER555"
  | "ASTABLE"
  | "HALF_ADDER"
  | "HALF_SUB";

type ModuleTemplate = {
  templateId: string;
  title: string;
  chip: string;
  type: GateType;
  qty: number;
  inputs: number;
  outputs: number;
  category: string;
};

type PlacedModule = ModuleTemplate & {
  instanceId: string;
  slotIndex: number;
  inputPins: string[];
  outputPins: string[];
};

type Wire = {
  id: string;
  from: string;
  to: string;
  color: string;
};

type PinBox = {
  x: number;
  y: number;
};

type TrainerState = {
  slots: Array<PlacedModule | null>;
  wires: Wire[];
  values: Record<string, boolean>;
};

type SavedTrainerState = {
  power: boolean;
  dip: boolean[];
  slides: boolean[];
  buttons: boolean[];
  dial: number;
  slots: Array<PlacedModule | null>;
  wires: Wire[];
  memory: Record<string, number>;
};

const TrainerContext = createContext<TrainerState | null>(null);

const wireColors = ["#ef4444", "#2563eb", "#16a34a", "#f59e0b", "#7c3aed", "#0f766e", "#db2777", "#111827"];
const storageKey = "hbe-logic-trainer-state-v1";

const inventory: ModuleTemplate[] = [
  item("7400", "NAND Gate", "7400", "NAND", 6, 4, 2, "Basic Gates"),
  item("7402", "NOR Gate", "7402", "NOR", 2, 4, 2, "Basic Gates"),
  item("7404", "NOT Gate", "7404", "NOT", 3, 2, 2, "Basic Gates"),
  item("7408", "AND Gate", "7408", "AND", 2, 4, 2, "Basic Gates"),
  item("7410", "3-In NAND", "7410", "NAND3", 2, 6, 2, "Logic Circuit Block"),
  item("7420", "4-In NAND", "7420", "NAND4", 1, 8, 2, "Logic Circuit Block"),
  item("7432", "OR Gate", "7432", "OR", 2, 4, 2, "Logic Circuit Block"),
  item("7486", "XOR Gate", "7486", "XOR", 5, 4, 2, "Logic Circuit Block"),
  item("7442", "Decimal Decoder", "7442", "DECODER7442", 1, 4, 10, "74 Series"),
  item("7447", "7-Seg Decoder", "7447", "SEG7447", 1, 4, 7, "74 Series"),
  item("7475", "4-Bit Latch", "7475", "LATCH7475", 1, 8, 4, "74 Series"),
  item("7483", "4-Bit Full Adder", "7483", "ADDER7483", 1, 9, 5, "74 Series"),
  item("7485", "4-Bit Comparator", "7485", "COMP7485", 1, 10, 3, "74 Series"),
  item("7490", "Decimal Counter", "7490", "COUNTER7490", 1, 1, 4, "74 Series"),
  item("74393", "Binary Counter", "74393", "COUNTER74393", 1, 1, 4, "Registers"),
  item("7473", "Dual JK Flip Flop", "7473", "JK7473", 2, 3, 2, "Registers"),
  item("7474", "Dual D Flip Flop", "7474", "D7474", 2, 2, 2, "Registers"),
  item("NE555", "Timer Module", "NE555", "TIMER555", 1, 1, 1, "Application Circuits"),
  item("2SC1815", "Multivibrator 1", "2SC1815", "ASTABLE", 2, 1, 2, "Application Circuits"),
  item("2SC1266", "Multivibrator 2", "2SC1266", "ASTABLE", 1, 1, 2, "Application Circuits"),
  item("HA", "Half Adder", "HA", "HALF_ADDER", 4, 2, 2, "Combinational Logic"),
  item("HS", "Half Subtracter", "HS", "HALF_SUB", 4, 2, 2, "Combinational Logic")
];

function item(
  templateId: string,
  title: string,
  chip: string,
  type: GateType,
  qty: number,
  inputs: number,
  outputs: number,
  category: string
): ModuleTemplate {
  return { templateId, title, chip, type, qty, inputs, outputs, category };
}

function makePlacedModule(template: ModuleTemplate, slotIndex: number, instanceId: string): PlacedModule {
  return {
    ...template,
    instanceId,
    slotIndex,
    inputPins: Array.from({ length: template.inputs }, (_, index) => `MOD:${instanceId}:I${index}`),
    outputPins: Array.from({ length: template.outputs }, (_, index) => `MOD:${instanceId}:O${index}`)
  };
}

export default function LogicTrainer() {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const wireLayerRef = useRef<SVGSVGElement | null>(null);
  const [power, setPower] = useState(true);
  const [dip, setDip] = useState<boolean[]>(Array(32).fill(false));
  const [slides, setSlides] = useState<boolean[]>(Array(12).fill(false));
  const [buttons, setButtons] = useState<boolean[]>(Array(4).fill(false));
  const [dial, setDial] = useState(2);
  const [pulse, setPulse] = useState(false);
  const [slots, setSlots] = useState<Array<PlacedModule | null>>(Array(16).fill(null));
  const [wires, setWires] = useState<Wire[]>([]);
  const [memory, setMemory] = useState<Record<string, number>>({});
  const [pinBoxes, setPinBoxes] = useState<Record<string, PinBox>>({});
  const [dragWire, setDragWire] = useState<{ from: string; point: PinBox } | null>(null);
  const dragWireRef = useRef<{ from: string; point: PinBox } | null>(null);
  const [hoverPin, setHoverPin] = useState<string | null>(null);
  const justDraggedRef = useRef(false);
  const [selectedPin, setSelectedPin] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [message, setMessage] = useState("Drag a white module card onto a black socket, then wire output pins to input pins.");

  const placedModules = useMemo(() => slots.filter(Boolean) as PlacedModule[], [slots]);

  useEffect(() => {
    const period = Math.max(40, 1000 / dial);
    const timer = window.setInterval(() => setPulse((value) => !value), period);
    return () => window.clearInterval(timer);
  }, [dial]);

  const readPins = useCallback(() => {
    const layer = wireLayerRef.current?.getBoundingClientRect() || boardRef.current?.getBoundingClientRect();
    if (!layer) return;
    const next: Record<string, PinBox> = {};
    document.querySelectorAll<HTMLElement>("[data-pin-id]").forEach((node) => {
      const id = node.dataset.pinId;
      if (!id) return;
      const anchor = node.querySelector<HTMLElement>("[data-pin-anchor]");
      const rect = (anchor || node).getBoundingClientRect();
      next[id] = {
        x: rect.left - layer.left + rect.width / 2,
        y: rect.top - layer.top + rect.height / 2
      };
    });
    setPinBoxes(next);
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<SavedTrainerState>;
        if (typeof saved.power === "boolean") setPower(saved.power);
        if (Array.isArray(saved.dip) && saved.dip.length === 32) setDip(saved.dip.map(Boolean));
        if (Array.isArray(saved.slides) && saved.slides.length === 12) setSlides(saved.slides.map(Boolean));
        if (Array.isArray(saved.buttons) && saved.buttons.length === 4) setButtons(saved.buttons.map(Boolean));
        if (typeof saved.dial === "number") setDial(saved.dial);
        if (Array.isArray(saved.slots) && saved.slots.length === 16) setSlots(saved.slots);
        if (Array.isArray(saved.wires)) setWires(saved.wires);
        if (saved.memory && typeof saved.memory === "object") setMemory(saved.memory);
        setMessage("Restored saved trainer layout from this browser.");
        window.setTimeout(readPins, 0);
      }
    } catch {
      setMessage("Saved trainer layout could not be restored.");
    } finally {
      setHydrated(true);
    }
  }, [readPins]);

  useEffect(() => {
    if (!hydrated) return;
    const saved: SavedTrainerState = { power, dip, slides, buttons, dial, slots, wires, memory };
    window.localStorage.setItem(storageKey, JSON.stringify(saved));
  }, [buttons, dial, dip, hydrated, memory, power, slides, slots, wires]);

  useEffect(() => {
    readPins();
    window.addEventListener("resize", readPins);
    return () => window.removeEventListener("resize", readPins);
  }, [readPins, slots]);

  useEffect(() => {
    document.querySelectorAll<HTMLElement>("[data-pin-id]").forEach((node) => {
      node.classList.remove("pin-drop-ok", "pin-drop-bad");
      const id = node.dataset.pinId;
      if (!dragWire || !id || !hoverPin || id !== hoverPin || id === dragWire.from) return;
      node.classList.add(resolveConnection(dragWire.from, id) ? "pin-drop-ok" : "pin-drop-bad");
    });
    return () => {
      document.querySelectorAll<HTMLElement>("[data-pin-id]").forEach((node) => node.classList.remove("pin-drop-ok", "pin-drop-bad"));
    };
  }, [dragWire, hoverPin, slots]);

  const values = useMemo(() => {
    const next: Record<string, boolean> = {};
    for (let i = 0; i < 16; i += 1) next[`PU${i}`] = power;
    for (let i = 0; i < 16; i += 1) next[`PD${i}`] = false;
    dip.forEach((value, index) => (next[`DIP${index}`] = power && value));
    slides.forEach((value, index) => (next[`SLIDE${index}`] = power && value));
    buttons.forEach((value, index) => (next[`BTN${index}`] = power && value));
    next.PULSE = power && pulse;

    for (let pass = 0; pass < Math.max(6, placedModules.length * 2); pass += 1) {
      placedModules.forEach((module) => {
        const input = module.inputPins.map((pin) => {
          const value = valueFromWire(pin, wires, next);
          next[pin] = value;
          return value;
        });
        const output = evaluateModule(module, input, memory, pulse);
        module.outputPins.forEach((pin, index) => {
          next[pin] = power && Boolean(output[index]);
        });
      });
    }

    for (let i = 0; i < 16; i += 1) next[`LED${i}`] = power && valueFromWire(`LED${i}`, wires, next);
    ["ANODE", "CATHODE"].forEach((prefix) => {
      ["a", "b", "c", "d", "e", "f", "g", "dp"].forEach((seg) => {
        next[`${prefix}-${seg}`] = power && valueFromWire(`${prefix}-${seg}`, wires, next);
      });
    });
    return next;
  }, [buttons, dip, memory, placedModules, power, pulse, slides, wires]);

  useEffect(() => {
    setMemory((prev) => {
      const next = { ...prev };
      let changed = false;
      placedModules.forEach((module) => {
        if ((module.type === "COUNTER74393" || module.type === "COUNTER7490") && values[module.inputPins[0]]) {
          const limit = module.type === "COUNTER7490" ? 10 : 16;
          next[module.instanceId] = ((next[module.instanceId] || 0) + 1) % limit;
          changed = true;
        }
        if (module.type === "JK7473" && values[module.inputPins[2]]) {
          const j = values[module.inputPins[0]];
          const k = values[module.inputPins[1]];
          next[module.instanceId] = j && k ? Number(!next[module.instanceId]) : j ? 1 : k ? 0 : next[module.instanceId] || 0;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [pulse]);

  useEffect(() => {
    setMemory((prev) => {
      const next = { ...prev };
      let changed = false;
      placedModules
        .filter((module) => module.type === "LATCH7475")
        .forEach((module) => {
          module.inputPins.slice(4, 8).forEach((pin, index) => {
            if (!values[pin]) return;
            const key = `${module.instanceId}:${index}`;
            const value = Number(values[module.inputPins[index]]);
            if (next[key] !== value) {
              next[key] = value;
              changed = true;
            }
          });
        });
      return changed ? next : prev;
    });
  }, [placedModules, values]);

  function placeModule(slotIndex: number, templateId: string) {
    const template = inventory.find((module) => module.templateId === templateId);
    if (!template || slots[slotIndex]) return;
    const used = slots.filter((module) => module?.templateId === templateId).length;
    if (used >= template.qty) {
      setMessage(`${template.chip} inventory is exhausted.`);
      return;
    }
    const instanceId = `${template.templateId}-${Date.now().toString(36)}-${slotIndex}`;
    setSlots((current) => current.map((module, index) => (index === slotIndex ? makePlacedModule(template, slotIndex, instanceId) : module)));
    setMessage(`${template.chip} snapped into socket ${slotIndex + 1}.`);
    window.setTimeout(readPins, 0);
  }

  function removeModule(slotIndex: number) {
    const module = slots[slotIndex];
    if (!module) return;
    setSlots((current) => current.map((item, index) => (index === slotIndex ? null : item)));
    setWires((current) => current.filter((wire) => !wire.from.includes(module.instanceId) && !wire.to.includes(module.instanceId)));
    setMessage(`${module.chip} removed from socket ${slotIndex + 1}.`);
    window.setTimeout(readPins, 0);
  }

  function disconnectSource(source: string) {
    setWires((current) => {
      const next = current.filter((wire) => wire.from !== source);
      if (next.length !== current.length) setMessage(`Disconnected ${labelPin(source)}.`);
      return next;
    });
  }

  function disconnectPin(pin: string) {
    setWires((current) => {
      const next = current.filter((wire) => wire.from !== pin && wire.to !== pin);
      if (next.length !== current.length) setMessage(`Disconnected ${labelPin(pin)}.`);
      return next;
    });
  }

  function connectPins(first: string, second: string) {
    const connection = first !== second ? resolveConnection(first, second) : null;
    if (!connection) {
      setMessage("Pick one output/source pin and one input/target pin.");
      return false;
    }

    setWires((current) => {
      if (connection.from.startsWith("DIP") && current.some((wire) => wire.from === connection.from)) {
        setMessage("Each DIP switch pin can drive only one jumper cable.");
        return current;
      }
      const next = current.filter((wire) => wire.to !== connection.to);
      next.push({ id: crypto.randomUUID(), from: connection.from, to: connection.to, color: wireColors[next.length % wireColors.length] });
      setMessage(`Connected ${labelPin(connection.from)} to ${labelPin(connection.to)}.`);
      return next;
    });
    setSelectedPin(null);
    window.setTimeout(readPins, 0);
    return true;
  }

  function handlePinClick(pin: string) {
    if (selectedPin) {
      if (selectedPin === pin) {
        setSelectedPin(null);
        setMessage(`Selection cleared.`);
        return;
      }
      connectPins(selectedPin, pin);
      return;
    }
    setSelectedPin(pin);
    setMessage(`Selected ${labelPin(pin)}. Click a compatible connector to attach a jumper.`);
  }

  function beginWire(event: PointerEvent<HTMLElement>, from: string) {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    justDraggedRef.current = true;
    const layer = wireLayerRef.current?.getBoundingClientRect() || boardRef.current?.getBoundingClientRect();
    if (!layer) return;
    const next = { from, point: { x: event.clientX - layer.left, y: event.clientY - layer.top } };
    dragWireRef.current = next;
    setDragWire(next);
  }

  function moveWire(event: PointerEvent<HTMLElement>) {
    const current = dragWireRef.current;
    if (!current) return;
    const layer = wireLayerRef.current?.getBoundingClientRect() || boardRef.current?.getBoundingClientRect();
    if (!layer) return;
    const next = { ...current, point: { x: event.clientX - layer.left, y: event.clientY - layer.top } };
    dragWireRef.current = next;
    setDragWire(next);
  }

  function finishWireAt(clientX: number, clientY: number) {
    const current = dragWireRef.current;
    if (!current) return false;
    const target = document.elementFromPoint(clientX, clientY)?.closest("[data-pin-id]") as HTMLElement | null;
    const to = target?.dataset.pinId || nearestCompatiblePin(clientX, clientY, current.from);
    if (to && to !== current.from && resolveConnection(current.from, to)) {
      connectPins(current.from, to);
    } else if (to && to !== current.from) {
      setMessage("That jumper needs one output/source pin and one input/target pin.");
    }
    dragWireRef.current = null;
    setDragWire(null);
    window.setTimeout(readPins, 0);
    return true;
  }

  function finishWire(event: PointerEvent<HTMLElement>) {
    const didFinish = finishWireAt(event.clientX, event.clientY);
    if (!didFinish) return;
    event.preventDefault();
    event.stopPropagation();
  }

  useEffect(() => {
    const handleMove = (event: globalThis.PointerEvent) => {
      const current = dragWireRef.current;
      if (!current) return;
      const layer = wireLayerRef.current?.getBoundingClientRect() || boardRef.current?.getBoundingClientRect();
      if (!layer) return;
      const next = { ...current, point: { x: event.clientX - layer.left, y: event.clientY - layer.top } };
      dragWireRef.current = next;
      setDragWire(next);
      const targetEl = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest("[data-pin-id]") as HTMLElement | null;
      const targetId = targetEl?.dataset.pinId;
      const candidate =
        targetId && targetId !== current.from ? targetId : nearestCompatiblePin(event.clientX, event.clientY, current.from);
      setHoverPin(candidate && candidate !== current.from ? candidate : null);
    };
    const handleUp = (event: globalThis.PointerEvent) => {
      const finished = finishWireAt(event.clientX, event.clientY);
      setHoverPin(null);
      if (finished) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("pointermove", handleMove, true);
    window.addEventListener("pointerup", handleUp, true);
    return () => {
      window.removeEventListener("pointermove", handleMove, true);
      window.removeEventListener("pointerup", handleUp, true);
    };
  });

  const sourceHandlers = (pin: string) => ({
    onPointerDown: (event: PointerEvent<HTMLElement>) => beginWire(event, pin),
    onPointerMove: moveWire,
    onPointerUp: finishWire,
    onPointerCancel: () => {
      dragWireRef.current = null;
      setDragWire(null);
      setHoverPin(null);
    }
  });

  const contextValue = useMemo<TrainerState>(() => ({ slots, wires, values }), [slots, values, wires]);
  const connectedSources = useMemo(() => new Set(wires.map((wire) => wire.from)), [wires]);
  const connectedPins = useMemo(() => new Set(wires.flatMap((wire) => [wire.from, wire.to])), [wires]);

  return (
    <TrainerContext.Provider value={contextValue}>
      <main className="min-h-dvh overflow-auto p-4 text-[#1d1d1b]">
        <div className="mx-auto grid w-[1800px] grid-cols-[300px_1480px] gap-5">
          <ModuleInventory drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen} slots={slots} />
          <div>
            <div className="metal-edge h-9 rounded-t-[18px] border-x-[18px] border-t-[8px] border-[#252525] shadow-md" />
            <section
              ref={boardRef}
              className="hardware-board relative grid h-[980px] grid-cols-[215px_1fr_220px] grid-rows-[118px_1fr_112px] gap-3 border-x-[18px] border-b-[18px] border-[#202020] p-5 shadow-2xl"
              onPointerMove={moveWire}
              onPointerUp={finishWire}
            >
              <WireLayer ref={wireLayerRef} wires={wires} dragWire={dragWire} pinBoxes={pinBoxes} values={values} />
              <CaseHardware />
              <PullRail top values={values} sourceHandlers={sourceHandlers} connectedSources={connectedSources} disconnectSource={disconnectSource} />
              <LeftInputs
                dip={dip}
                setDip={setDip}
                slides={slides}
                setSlides={setSlides}
                buttons={buttons}
                setButtons={setButtons}
                dial={dial}
                setDial={setDial}
                sourceHandlers={sourceHandlers}
                values={values}
                connectedSources={connectedSources}
                disconnectSource={disconnectSource}
              />
              <CenterGrid
                slots={slots}
                values={values}
                sourceHandlers={sourceHandlers}
                onPlace={placeModule}
                onRemove={removeModule}
                connectedPins={connectedPins}
                disconnectPin={disconnectPin}
                selectedPin={selectedPin}
                handlePinClick={handlePinClick}
                justDraggedRef={justDraggedRef}
              />
              <RightOutputs
                power={power}
                setPower={setPower}
                values={values}
                connectedPins={connectedPins}
                selectedPin={selectedPin}
                handlePinClick={handlePinClick}
                disconnectPin={disconnectPin}
                sourceHandlers={sourceHandlers}
                dragging={Boolean(dragWire)}
                justDraggedRef={justDraggedRef}
              />
              <PullRail values={values} sourceHandlers={sourceHandlers} connectedSources={connectedSources} disconnectSource={disconnectSource} />
            </section>
            <div className="metal-edge flex h-20 items-center justify-center rounded-b-[18px] border-x-[18px] border-b-[10px] border-[#252525] shadow-2xl">
              <div className="h-10 w-64 rounded-b-full border-4 border-[#5b5b5b] bg-gradient-to-b from-[#efefef] to-[#787878] shadow-inner" />
            </div>
            <div className="mt-3 border-4 border-[#111] bg-[#f2efe6] px-4 py-3 text-[13px] font-black shadow-[6px_6px_0_#000]">
              {message} <span className="ml-4 text-[#555]">{wires.length} jumper cables</span>
            </div>
          </div>
        </div>
      </main>
    </TrainerContext.Provider>
  );
}

function ModuleInventory({
  drawerOpen,
  setDrawerOpen,
  slots
}: {
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  slots: Array<PlacedModule | null>;
}) {
  const groups = [...new Set(inventory.map((module) => module.category))];
  return (
    <aside className="sticky top-4 h-[calc(100dvh-32px)] border-4 border-[#111] bg-[#d8d3c8] shadow-[8px_8px_0_#000]">
      <button
        type="button"
        onClick={() => setDrawerOpen(!drawerOpen)}
        className="flex h-12 w-full items-center justify-between border-b-4 border-[#111] bg-[#f4f1e8] px-4 text-left text-[14px] font-black uppercase"
      >
        Logic Modules
        <span>{drawerOpen ? "Close" : "Open"}</span>
      </button>
      {drawerOpen ? (
        <div className="h-[calc(100%-48px)] overflow-auto p-3">
          {groups.map((group) => (
            <section key={group} className="mb-4">
              <div className="mb-2 bg-[#111] px-2 py-1 text-[11px] font-black uppercase text-white">{group}</div>
              <div className="grid gap-3">
                {inventory
                  .filter((module) => module.category === group)
                  .map((module) => {
                    const used = slots.filter((slot) => slot?.templateId === module.templateId).length;
                    const remaining = module.qty - used;
                    return <InventoryCard key={module.templateId} module={module} remaining={remaining} />;
                  })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="p-4 text-[12px] font-black uppercase text-[#333]">Inventory collapsed</div>
      )}
    </aside>
  );
}

function InventoryCard({ module, remaining }: { module: ModuleTemplate; remaining: number }) {
  return (
    <div
      draggable={remaining > 0}
      onDragStart={(event) => {
        event.dataTransfer.setData("application/x-module-template", module.templateId);
        event.dataTransfer.effectAllowed = "copy";
      }}
      className={`plate relative h-28 rounded-sm border-2 border-[#111] p-3 shadow-[5px_5px_0_#000] ${remaining > 0 ? "cursor-grab active:cursor-grabbing" : "cursor-not-allowed opacity-45"}`}
    >
      <FourScrews />
      <div className="text-center text-[12px] font-black printed-label">{module.title} ({module.chip})</div>
      <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
        <MiniLogicMark type={module.type} />
        <span className="border-2 border-[#111] bg-white px-2 py-1 text-[11px] font-black">x{remaining}</span>
      </div>
    </div>
  );
}

function CaseHardware() {
  return (
    <>
      <div className="absolute left-8 top-5 h-5 w-28 rounded-sm border border-[#777] bg-gradient-to-b from-[#f4f4f4] to-[#858585] shadow-md" />
      <div className="absolute right-8 top-5 h-5 w-28 rounded-sm border border-[#777] bg-gradient-to-b from-[#f4f4f4] to-[#858585] shadow-md" />
      <div className="absolute left-2 top-2 h-20 w-8 rounded bg-black/20 shadow-inner" />
      <div className="absolute right-2 top-2 h-20 w-8 rounded bg-black/20 shadow-inner" />
      <div className="absolute bottom-3 left-10 text-[12px] font-black printed-label">(주) 한백전자</div>
      <div className="absolute bottom-3 right-72 text-[12px] font-black printed-label">Serial Number :</div>
    </>
  );
}

function PullRail({
  top = false,
  values,
  sourceHandlers,
  connectedSources,
  disconnectSource
}: {
  top?: boolean;
  values: Record<string, boolean>;
  sourceHandlers: (pin: string) => object;
  connectedSources: Set<string>;
  disconnectSource: (source: string) => void;
}) {
  const prefix = top ? "PU" : "PD";
  return (
    <section className={`${top ? "col-span-3 row-start-1" : "col-span-3 row-start-3"} plate relative rounded-sm border border-[#c9c1b4] p-4 shadow-inner`}>
      <FourScrews />
      <div className="mb-2 text-center text-[13px] font-black printed-label">{top ? "Pull-up Resistor Block" : "Pull-down Resistor Block"}</div>
      <div className="mx-auto grid w-[980px] grid-cols-[repeat(16,minmax(0,1fr))] gap-4">
        {Array.from({ length: 16 }, (_, index) => {
          const id = `${prefix}${index}`;
          const isConnected = connectedSources.has(id);
          return (
            <div key={index} className="flex flex-col items-center gap-1">
              <button
                type="button"
                data-pin-id={id}
                className={`pin-metal h-5 w-5 rounded-full ${values[id] ? "ring-2 ring-green-400" : ""} ${isConnected ? "ring-4 ring-[#ffd000]" : ""}`}
                aria-label={`${id} pin`}
                onClick={() => {
                  if (isConnected) disconnectSource(id);
                }}
                {...sourceHandlers(id)}
              />
            <ResistorIcon ground={!top} />
              <span className="text-[9px] font-black printed-label">{top ? "+5V" : "GND"}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function LeftInputs(props: {
  dip: boolean[];
  setDip: (next: boolean[]) => void;
  slides: boolean[];
  setSlides: (next: boolean[]) => void;
  buttons: boolean[];
  setButtons: (next: boolean[]) => void;
  dial: number;
  setDial: (value: number) => void;
  sourceHandlers: (pin: string) => {
    onPointerDown: (event: PointerEvent<HTMLElement>) => void;
    onPointerMove: (event: PointerEvent<HTMLElement>) => void;
    onPointerUp: (event: PointerEvent<HTMLElement>) => void;
    onPointerCancel: () => void;
  };
  values: Record<string, boolean>;
  connectedSources: Set<string>;
  disconnectSource: (source: string) => void;
}) {
  return (
    <aside className="col-start-1 row-start-2 grid gap-3">
      <Panel title="DIP Switch">
        <div className="grid gap-2">
          {Array.from({ length: 4 }, (_, bank) => (
            <div key={bank} className="grid grid-cols-8 gap-1 rounded bg-white/80 p-1 shadow-inner">
              {Array.from({ length: 8 }, (_, bit) => {
                const index = bank * 8 + bit;
                const id = `DIP${index}`;
                const isConnected = props.connectedSources.has(id);
                return (
                  <button
                    key={index}
                    type="button"
                    data-pin-id={id}
                    className={`relative h-9 rounded-[2px] border border-[#9b9b9b] bg-[#f8f8f8] shadow-md ${props.dip[index] ? "pt-1" : "pb-1"} ${isConnected ? "ring-4 ring-[#ffd000]" : ""}`}
                    onClick={() => {
                      if (isConnected) props.disconnectSource(id);
                      else props.setDip(props.dip.map((value, i) => (i === index ? !value : value)));
                    }}
                    {...props.sourceHandlers(id)}
                    aria-label={`DIP ${index + 1}`}
                  >
                    <span className={`block h-4 w-full rounded-[1px] border border-[#671212] bg-gradient-to-b ${props.dip[index] ? "from-[#ff7772] to-[#b11818]" : "from-[#8b1212] to-[#ff4b43]"}`} />
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Slide Switch">
        <div className="grid grid-cols-4 gap-2">
          {props.slides.map((value, index) => {
            const id = `SLIDE${index}`;
            const isConnected = props.connectedSources.has(id);
            return (
              <button
                key={index}
                type="button"
                data-pin-id={id}
                className={`h-10 rounded-sm border border-[#151515] bg-[#1b1b1b] p-1 shadow-inner ${isConnected ? "ring-4 ring-[#ffd000]" : ""}`}
                onClick={() => {
                  if (isConnected) props.disconnectSource(id);
                  else props.setSlides(props.slides.map((item, i) => (i === index ? !item : item)));
                }}
                {...props.sourceHandlers(id)}
                aria-label={`Slide switch ${index + 1}`}
              >
                <span className={`block h-full w-1/2 rounded-sm bg-gradient-to-b from-[#4a4a4a] to-[#050505] shadow-md transition-transform ${value ? "translate-x-full" : ""}`} />
              </button>
            );
          })}
        </div>
      </Panel>
      <Panel title="Button Switch">
        <div className="grid grid-cols-2 gap-3">
          {props.buttons.map((value, index) => (
            <PushButton
              key={index}
              index={index}
              active={value}
              connected={props.connectedSources.has(`BTN${index}`)}
              setButtons={props.setButtons}
              buttons={props.buttons}
              sourceHandlers={props.sourceHandlers(`BTN${index}`)}
              disconnectSource={() => props.disconnectSource(`BTN${index}`)}
            />
          ))}
        </div>
      </Panel>
      <Panel title="Waveform Generator">
        <div className="flex items-center justify-between">
          <button
            type="button"
            data-pin-id="PULSE"
            className={`pin-metal h-6 w-6 rounded-full ${props.connectedSources.has("PULSE") ? "ring-4 ring-[#ffd000]" : ""}`}
            onClick={() => {
              if (props.connectedSources.has("PULSE")) props.disconnectSource("PULSE");
            }}
            {...props.sourceHandlers("PULSE")}
            aria-label="Pulse output"
          />
          <div className="relative grid h-20 w-20 place-items-center rounded-full border-4 border-[#aaa] bg-gradient-to-br from-[#e8e8e8] to-[#777] shadow-inner">
            <div className="h-14 w-14 rounded-full border-2 border-[#134f73] bg-[radial-gradient(circle_at_35%_28%,#58b9dc,#105579_72%)] shadow-md" />
            <div className="absolute left-1/2 top-2 h-8 w-1 origin-bottom -translate-x-1/2 rounded bg-[#052b3a]" style={{ transform: `translateX(-50%) rotate(${Math.min(300, (props.dial / 1000) * 300)}deg)` }} />
          </div>
        </div>
        <input className="mt-3 w-full accent-[#12627f]" min={0.2} max={1000} step={0.2} value={props.dial} type="range" onChange={(event) => props.setDial(Number(event.target.value))} />
        <div className="mt-1 text-center text-[10px] font-black printed-label">{props.dial.toFixed(props.dial < 10 ? 1 : 0)} Hz</div>
      </Panel>
      <Panel title="DAQ: PC Board">
        <DaqPort />
      </Panel>
    </aside>
  );
}

function PushButton({
  index,
  active,
  connected,
  buttons,
  setButtons,
  sourceHandlers,
  disconnectSource
}: {
  index: number;
  active: boolean;
  connected: boolean;
  buttons: boolean[];
  setButtons: (next: boolean[]) => void;
  sourceHandlers: {
    onPointerDown: (event: PointerEvent<HTMLElement>) => void;
    onPointerMove: (event: PointerEvent<HTMLElement>) => void;
    onPointerUp: (event: PointerEvent<HTMLElement>) => void;
    onPointerCancel: () => void;
  };
  disconnectSource: () => void;
}) {
  const setActive = (value: boolean) => setButtons(buttons.map((item, i) => (i === index ? value : item)));

  return (
    <button
      type="button"
      data-pin-id={`BTN${index}`}
      className={`h-14 rounded-full border-4 border-[#1b1b1b] text-[10px] font-black shadow-md ${
        active
          ? "translate-y-1 bg-[radial-gradient(circle_at_35%_28%,#fff9a8,#ffd000_50%,#a36b00_88%)] text-[#231900] shadow-inner"
          : "bg-[radial-gradient(circle_at_35%_28%,#777,#1d1d1d_72%)] text-white"
      } ${connected ? "ring-4 ring-[#ffd000]" : ""}`}
      onClick={() => {
        if (connected) disconnectSource();
      }}
      onPointerDown={(event) => {
        setActive(true);
        sourceHandlers.onPointerDown(event);
      }}
      onPointerMove={sourceHandlers.onPointerMove}
      onPointerUp={(event) => {
        setActive(false);
        sourceHandlers.onPointerUp(event);
      }}
      onPointerCancel={() => {
        setActive(false);
        sourceHandlers.onPointerCancel();
      }}
      onPointerLeave={() => setActive(false)}
      aria-label={`Button switch ${index + 1}`}
    >
      SW{index + 1}
    </button>
  );
}

function CenterGrid({
  slots,
  values,
  sourceHandlers,
  onPlace,
  onRemove,
  connectedPins,
  disconnectPin,
  selectedPin,
  handlePinClick,
  justDraggedRef
}: {
  slots: Array<PlacedModule | null>;
  values: Record<string, boolean>;
  sourceHandlers: (pin: string) => object;
  onPlace: (slotIndex: number, templateId: string) => void;
  onRemove: (slotIndex: number) => void;
  connectedPins: Set<string>;
  disconnectPin: (pin: string) => void;
  selectedPin: string | null;
  handlePinClick: (pin: string) => void;
  justDraggedRef: React.MutableRefObject<boolean>;
}) {
  return (
    <section className="col-start-2 row-start-2">
      <div className="mb-2 text-center text-[14px] font-black printed-label">Logic Circuit Design Block</div>
      <div className="grid h-full grid-cols-4 grid-rows-4 gap-3">
        {slots.map((module, index) => (
          <SocketBlock
            key={index}
            slotIndex={index}
            module={module}
            values={values}
            sourceHandlers={sourceHandlers}
            onPlace={onPlace}
            onRemove={onRemove}
            connectedPins={connectedPins}
            disconnectPin={disconnectPin}
            selectedPin={selectedPin}
            handlePinClick={handlePinClick}
            justDraggedRef={justDraggedRef}
          />
        ))}
      </div>
    </section>
  );
}

function SocketBlock({
  slotIndex,
  module,
  values,
  sourceHandlers,
  onPlace,
  onRemove,
  connectedPins,
  disconnectPin,
  selectedPin,
  handlePinClick,
  justDraggedRef
}: {
  slotIndex: number;
  module: PlacedModule | null;
  values: Record<string, boolean>;
  sourceHandlers: (pin: string) => object;
  onPlace: (slotIndex: number, templateId: string) => void;
  onRemove: (slotIndex: number) => void;
  connectedPins: Set<string>;
  disconnectPin: (pin: string) => void;
  selectedPin: string | null;
  handlePinClick: (pin: string) => void;
  justDraggedRef: React.MutableRefObject<boolean>;
}) {
  return (
    <div
      onDragOver={(event) => {
        if (!module) event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        const templateId = event.dataTransfer.getData("application/x-module-template");
        if (templateId) onPlace(slotIndex, templateId);
      }}
      className="relative rounded-md border-2 border-[#050505] bg-[#080808] p-2 shadow-inner"
    >
      <div className="absolute inset-2 grid grid-cols-2 gap-x-20">
        <SocketPinColumn />
        <SocketPinColumn />
      </div>
      <div className="absolute left-1/2 top-2 -translate-x-1/2 text-[9px] font-black text-[#777]">SOCKET {slotIndex + 1}</div>
      {module ? (
        <ModulePlate
          module={module}
          values={values}
          sourceHandlers={sourceHandlers}
          onRemove={() => onRemove(slotIndex)}
          connectedPins={connectedPins}
          disconnectPin={disconnectPin}
          selectedPin={selectedPin}
          handlePinClick={handlePinClick}
          justDraggedRef={justDraggedRef}
        />
      ) : null}
    </div>
  );
}

function SocketPinColumn() {
  return (
    <div className="grid content-center gap-2">
      {Array.from({ length: 8 }, (_, index) => (
        <span key={index} className="h-2.5 w-2.5 rounded-full border border-[#444] bg-[#020202] shadow-[inset_0_1px_3px_#777]" />
      ))}
    </div>
  );
}

function ModulePlate({
  module,
  values,
  sourceHandlers,
  onRemove,
  connectedPins,
  disconnectPin,
  selectedPin,
  handlePinClick,
  justDraggedRef
}: {
  module: PlacedModule;
  values: Record<string, boolean>;
  sourceHandlers: (pin: string) => object;
  onRemove: () => void;
  connectedPins: Set<string>;
  disconnectPin: (pin: string) => void;
  selectedPin: string | null;
  handlePinClick: (pin: string) => void;
  justDraggedRef: React.MutableRefObject<boolean>;
}) {
  return (
    <div
      className="plate absolute inset-1 z-10 rounded-sm border-2 border-[#111] p-3 shadow-[5px_5px_0_#000]"
      onDoubleClick={onRemove}
      title="Double-click to unslot module"
    >
      <FourScrews />
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-5 top-4 z-20 h-3 w-7 rounded-[1px] border border-[#6b6b6b] bg-gradient-to-b from-[#e7e7e7] to-[#777] shadow-inner"
        aria-label={`Release ${module.title}`}
      />
      <div className="text-center text-[11px] font-black printed-label">{module.title} ({module.chip})</div>
      <div className="absolute inset-0">
        {module.inputPins.map((pin, index) => (
          <button
            key={pin}
            type="button"
            data-pin-id={pin}
            style={modulePinStyle(module, index, "in", Boolean(values[pin]))}
            className={`pin-metal absolute left-0 z-30 h-5 w-5 -translate-y-1/2 rounded-full ${connectedPins.has(pin) ? "ring-4 ring-[#ffd000]" : ""} ${selectedPin === pin ? "outline outline-4 outline-[#ffea00]" : ""}`}
            aria-label={`${module.title} input ${index + 1}`}
            onClick={(event) => {
              event.stopPropagation();
              if (justDraggedRef.current) {
                justDraggedRef.current = false;
                return;
              }
              if (connectedPins.has(pin)) disconnectPin(pin);
              else handlePinClick(pin);
            }}
            {...sourceHandlers(pin)}
          />
        ))}
        {(module.type === "HALF_ADDER" || module.type === "HALF_SUB") &&
          module.inputPins.map((pin, index) => (
            <span
              key={`led-in-${pin}`}
              className={`absolute left-3 z-20 h-2 w-2 -translate-y-1/2 rounded-full border border-[#6b0808] ${values[pin] ? "bg-[radial-gradient(circle_at_35%_28%,#fff,#ff6767_42%,#c40000_80%)] shadow-[0_0_6px_#ff1f1f]" : "bg-[radial-gradient(circle_at_35%_28%,#5b1515,#1c0505_75%)]"}`}
              style={{ top: `${pinTop(module, index, "in")}px` }}
            />
          ))}
      </div>
      <div className="absolute inset-0">
        {module.outputPins.map((pin, index) => (
          <button
            key={pin}
            type="button"
            data-pin-id={pin}
            style={modulePinStyle(module, index, "out", Boolean(values[pin]))}
            className={`pin-metal absolute right-0 z-30 h-5 w-5 -translate-y-1/2 rounded-full ${connectedPins.has(pin) ? "ring-4 ring-[#ffd000]" : ""} ${selectedPin === pin ? "outline outline-4 outline-[#ffea00]" : ""}`}
            aria-label={`${module.title} output ${index + 1}`}
            onClick={(event) => {
              event.stopPropagation();
              if (justDraggedRef.current) {
                justDraggedRef.current = false;
                return;
              }
              if (connectedPins.has(pin)) disconnectPin(pin);
              else handlePinClick(pin);
            }}
            {...sourceHandlers(pin)}
          />
        ))}
        {(module.type === "HALF_ADDER" || module.type === "HALF_SUB") &&
          module.outputPins.map((pin, index) => (
            <span
              key={`led-out-${pin}`}
              className={`absolute right-3 z-20 h-2 w-2 -translate-y-1/2 rounded-full border border-[#6b0808] ${values[pin] ? "bg-[radial-gradient(circle_at_35%_28%,#fff,#ff6767_42%,#c40000_80%)] shadow-[0_0_6px_#ff1f1f]" : "bg-[radial-gradient(circle_at_35%_28%,#5b1515,#1c0505_75%)]"}`}
              style={{ top: `${pinTop(module, index, "out")}px` }}
            />
          ))}
      </div>
      <LogicDiagram module={module} />
      <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-2">
        <div className={`h-4 w-4 rounded-full border border-[#6b0808] ${module.outputPins.some((pin) => values[pin]) ? "bg-[radial-gradient(circle_at_35%_28%,#fff,#ff6767_42%,#c40000_80%)] shadow-[0_0_12px_#ff1f1f]" : "bg-[radial-gradient(circle_at_35%_28%,#5b1515,#1c0505_75%)]"}`} />
        <div className="h-3 w-12 rounded-sm bg-[#141414] shadow-inner" />
      </div>
    </div>
  );
}

function RightOutputs({
  power,
  setPower,
  values,
  connectedPins,
  selectedPin,
  handlePinClick,
  disconnectPin,
  sourceHandlers,
  dragging,
  justDraggedRef
}: {
  power: boolean;
  setPower: (power: boolean) => void;
  values: Record<string, boolean>;
  connectedPins: Set<string>;
  selectedPin: string | null;
  handlePinClick: (pin: string) => void;
  disconnectPin: (pin: string) => void;
  sourceHandlers: (pin: string) => {
    onPointerDown: (event: PointerEvent<HTMLElement>) => void;
    onPointerMove: (event: PointerEvent<HTMLElement>) => void;
    onPointerUp: (event: PointerEvent<HTMLElement>) => void;
    onPointerCancel: () => void;
  };
  dragging: boolean;
  justDraggedRef: React.MutableRefObject<boolean>;
}) {
  return (
    <aside className="col-start-3 row-start-2 grid gap-3">
      <Panel title="Anode Common 7-Segment">
        <SevenSegment
          prefix="ANODE"
          values={values}
          connectedPins={connectedPins}
          selectedPin={selectedPin}
          handlePinClick={handlePinClick}
          disconnectPin={disconnectPin}
          sourceHandlers={sourceHandlers}
          dragging={dragging}
          justDraggedRef={justDraggedRef}
        />
      </Panel>
      <Panel title="Cathode Common 7-Segment">
        <SevenSegment
          prefix="CATHODE"
          values={values}
          connectedPins={connectedPins}
          selectedPin={selectedPin}
          handlePinClick={handlePinClick}
          disconnectPin={disconnectPin}
          sourceHandlers={sourceHandlers}
          dragging={dragging}
          justDraggedRef={justDraggedRef}
        />
      </Panel>
      <Panel title="LED">
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 16 }, (_, index) => {
            const id = `LED${index}`;
            const isConnected = connectedPins.has(id);
            const isSelected = selectedPin === id;
            return (
              <div key={index} className="flex items-center justify-center gap-1.5">
                <span className="relative grid h-9 w-9 place-items-center rounded-full border-2 border-[#777] bg-[#c9c9c9] shadow-inner">
                  <span
                    className={`relative h-7 w-7 rounded-full border border-[#8d8d8d] shadow-inner after:absolute after:left-1.5 after:top-1 after:h-2 after:w-3 after:rounded-full after:bg-white/70 after:content-[''] ${
                      values[id]
                        ? "bg-[radial-gradient(circle_at_35%_28%,#fff,#ff7777_34%,#e00000_68%,#650000_100%)] shadow-[0_0_16px_#ff2a2a]"
                        : "bg-[radial-gradient(circle_at_35%_28%,#ffffff,#d7d7d7_42%,#777_100%)]"
                    }`}
                  />
                </span>
                <button
                  type="button"
                  data-pin-id={id}
                  className={`pin-metal z-30 h-5 w-5 shrink-0 rounded-full transition-opacity ${
                    isConnected ? "ring-4 ring-[#ffd000]" : ""
                  } ${isSelected ? "outline outline-4 outline-[#ffea00]" : ""} ${
                    dragging || isSelected || isConnected ? "opacity-100" : "opacity-60 hover:opacity-100"
                  }`}
                  aria-label={`LED ${index + 1} input connector`}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (justDraggedRef.current) {
                      justDraggedRef.current = false;
                      return;
                    }
                    if (isConnected) disconnectPin(id);
                    else handlePinClick(id);
                  }}
                  {...sourceHandlers(id)}
                />
              </div>
            );
          })}
        </div>
      </Panel>
      <Panel title="Power(+5V)">
        <div className="flex items-center justify-between">
          <div className="flex flex-col items-center gap-2">
            <span className="pin-metal h-7 w-7 rounded-full" />
            <span className="text-[10px] font-black printed-label">GND</span>
          </div>
          <button type="button" onClick={() => setPower(!power)} className="h-12 w-20 rounded-sm border-2 border-[#111] bg-[#222] p-1 shadow-inner" aria-label="Power toggle">
            <span className={`block h-full w-1/2 rounded-sm bg-gradient-to-b ${power ? "translate-x-full from-[#77ff77] to-[#149414]" : "from-[#ff8a8a] to-[#9b1010]"} shadow-md transition-transform`} />
          </button>
          <DaqPort small />
        </div>
      </Panel>
    </aside>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="plate relative rounded-sm border border-[#beb6aa] p-3 shadow-md">
      <FourScrews />
      <div className="mb-2 text-center text-[11px] font-black printed-label">{title}</div>
      {children}
    </section>
  );
}

function FourScrews() {
  return (
    <>
      <span className="screw absolute left-2 top-2" />
      <span className="screw absolute right-2 top-2" />
      <span className="screw absolute bottom-2 left-2" />
      <span className="screw absolute bottom-2 right-2" />
    </>
  );
}

function DaqPort({ small = false }: { small?: boolean }) {
  return <div className={`${small ? "h-8 w-16" : "h-10 w-full"} rounded-sm border-2 border-[#bfbfbf] bg-[repeating-linear-gradient(90deg,#f8f8f8_0_7px,#191919_7px_9px)] shadow-inner`} />;
}

function ResistorIcon({ ground }: { ground: boolean }) {
  return (
    <svg width="26" height="24" viewBox="0 0 26 24" aria-hidden="true">
      <path d="M13 1v5M13 18v3" stroke="#2f2f2f" strokeWidth="1.5" />
      <path d="M13 6l-4 2 8 3-8 3 8 3-4 1" fill="none" stroke="#9a5b13" strokeWidth="1.6" />
      {ground ? <path d="M7 21h12M9 23h8" stroke="#2f2f2f" strokeWidth="1.4" /> : <text x="3" y="23" fontSize="8" fontWeight="900">+5</text>}
    </svg>
  );
}

function MiniLogicMark({ type }: { type: GateType }) {
  return (
    <svg width="84" height="38" viewBox="0 0 84 38" aria-hidden="true">
      <g fill="none" stroke="#111" strokeWidth="2">
        {["AND", "NAND", "NAND3", "NAND4"].includes(type) && <path d="M18 7 H40 C56 7 56 31 40 31 H18 Z" />}
        {["OR", "NOR", "XOR"].includes(type) && <path d="M14 7 C24 15 24 23 14 31 C38 31 54 24 62 19 C54 14 38 7 14 7 Z" />}
        {type === "XOR" && <path d="M8 7 C18 15 18 23 8 31" />}
        {type === "NOT" && <path d="M18 7 L56 19 L18 31 Z" />}
        {["NAND", "NAND3", "NAND4", "NOR", "NOT"].includes(type) && <circle cx="64" cy="19" r="3.5" />}
        {!["AND", "NAND", "NAND3", "NAND4", "OR", "NOR", "XOR", "NOT"].includes(type) && <rect x="18" y="7" width="46" height="24" rx="1" />}
      </g>
    </svg>
  );
}

function pinTop(module: PlacedModule, index: number, side: "in" | "out") {
  const dual2 = ["NAND", "NOR", "AND", "OR", "XOR"].includes(module.type);
  if (dual2 && side === "in") return [58, 72, 108, 122][index] ?? 58;
  if (dual2 && side === "out") return [65, 115][index] ?? 65;
  if (module.type === "NOT" && side === "in") return [65, 115][index] ?? 65;
  if (module.type === "NOT" && side === "out") return [65, 115][index] ?? 65;
  if ((module.type === "HALF_ADDER" || module.type === "HALF_SUB") && side === "in") return [65, 115][index] ?? 65;
  if ((module.type === "HALF_ADDER" || module.type === "HALF_SUB") && side === "out") return [65, 115][index] ?? 65;
  if (module.type === "NAND3" && side === "in") return [48, 60, 72, 102, 114, 126][index] ?? 48;
  if (module.type === "NAND3" && side === "out") return [60, 114][index] ?? 60;
  if (module.type === "NAND4" && side === "in") return [42, 54, 66, 78, 96, 108, 120, 132][index] ?? 42;
  if (module.type === "NAND4" && side === "out") return [60, 114][index] ?? 60;
  const count = side === "in" ? module.inputPins.length : module.outputPins.length;
  if (count <= 1) return 88;
  return 48 + index * (84 / (count - 1));
}

function modulePinStyle(module: PlacedModule, index: number, side: "in" | "out", active: boolean) {
  return {
    top: `${pinTop(module, index, side)}px`,
    background: active
      ? "radial-gradient(circle at 35% 32%, #fff8b0 0 14%, #ffd000 34%, #bd8a00 68%, #5b3d00 100%)"
      : undefined
  };
}

function LogicDiagram({ module }: { module: PlacedModule }) {
  return (
    <svg className="pointer-events-none absolute inset-x-3 top-8 h-[112px] w-[calc(100%-24px)]" viewBox="0 0 170 112" aria-hidden="true">
      <g fill="none" stroke="#171717" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
        <PrintedRouting module={module} />
        <PrintedSymbol module={module} />
      </g>
    </svg>
  );
}

function PrintedRouting({ module }: { module: PlacedModule }) {
  const y = (pinIndex: number, side: "in" | "out") => pinTop(module, pinIndex, side) - 32;
  if (["NAND", "NOR", "AND", "OR", "XOR"].includes(module.type)) {
    return (
      <>
        <path d={`M0 ${y(0, "in")} H42 M0 ${y(1, "in")} H42 M0 ${y(2, "in")} H42 M0 ${y(3, "in")} H42`} />
        <path d={`M108 ${y(0, "out")} H170 M108 ${y(1, "out")} H170`} />
      </>
    );
  }
  if (module.type === "NOT") {
    return (
      <>
        <path d={`M0 ${y(0, "in")} H44 M0 ${y(1, "in")} H44`} />
        <path d={`M102 ${y(0, "out")} H170 M102 ${y(1, "out")} H170`} />
      </>
    );
  }
  if (module.type === "NAND3" || module.type === "NAND4") {
    const firstCount = module.type === "NAND3" ? 3 : 4;
    return (
      <>
        {Array.from({ length: module.inputs }, (_, index) => <path key={index} d={`M0 ${y(index, "in")} H42`} />)}
        <path d={`M108 ${y(0, "out")} H170 M108 ${y(1, "out")} H170`} />
      </>
    );
  }
  if (module.type === "HALF_ADDER" || module.type === "HALF_SUB") {
    return (
      <>
        <path d={`M0 ${y(0, "in")} H42 M0 ${y(1, "in")} H42`} />
        <path d={`M108 ${y(0, "out")} H170 M108 ${y(1, "out")} H170`} />
      </>
    );
  }
  return (
    <>
      {module.inputPins.map((_, index) => <path key={`i-${index}`} d={`M0 ${y(index, "in")} H48`} />)}
      {module.outputPins.map((_, index) => <path key={`o-${index}`} d={`M122 ${y(index, "out")} H170`} />)}
    </>
  );
}

function PrintedSymbol({ module }: { module: PlacedModule }) {
  const y = (pinIndex: number, side: "in" | "out") => pinTop(module, pinIndex, side) - 32;
  if (["NAND", "NOR", "AND", "OR", "XOR"].includes(module.type)) {
    return (
      <>
        <AnsiGate type={module.type} x={42} y={18} />
        <AnsiGate type={module.type} x={42} y={68} />
      </>
    );
  }
  if (module.type === "NOT") {
    return (
      <>
        <AnsiGate type="NOT" x={44} y={50 - 17} />
        <AnsiGate type="NOT" x={44} y={100 - 17} />
      </>
    );
  }
  if (module.type === "NAND3" || module.type === "NAND4") {
    return (
      <>
        <AnsiGate type="NAND" x={42} y={13} />
        <AnsiGate type="NAND" x={42} y={67} />
      </>
    );
  }
  if (module.type === "HALF_ADDER") {
    return (
      <>
        <path d={`M20 ${y(0, "in")} V${y(0, "out")} H42`} />
        <path d={`M20 ${y(1, "in")} V${y(0, "in") + 15} H42`} />
        <AnsiGate type="XOR" x={42} y={18} />
        <AnsiGate type="AND" x={42} y={68} />
      </>
    );
  }
  if (module.type === "HALF_SUB") {
    return (
      <>
        <path d={`M20 ${y(0, "in")} V60`} />
        <path d="M12 60 L34 68 L12 76 Z" />
        <circle cx="37" cy="68" r="2.5" />
        <path d="M37 68 H42" />
        <path d={`M20 ${y(1, "in")} V${y(0, "in") + 15} H42`} />
        <AnsiGate type="XOR" x={42} y={18} />
        <AnsiGate type="AND" x={42} y={68} />
      </>
    );
  }
  return <rect x="48" y="18" width="74" height="76" rx="2" />;
}

function AnsiGate({ type, x, y }: { type: GateType | "NAND"; x: number; y: number }) {
  const isAnd = ["AND", "NAND", "NAND3", "NAND4"].includes(type);
  const isOr = ["OR", "NOR", "XOR"].includes(type);
  const inverted = ["NAND", "NOR"].includes(type);
  if (type === "NOT") {
    return (
      <>
        <path d={`M${x} ${y} L${x + 44} ${y + 15} L${x} ${y + 30} Z`} />
        <circle cx={x + 50} cy={y + 15} r="4" />
      </>
    );
  }
  return (
    <>
      {isAnd ? <path d={`M${x} ${y} H${x + 25} C${x + 53} ${y}, ${x + 53} ${y + 30}, ${x + 25} ${y + 30} H${x} Z`} /> : null}
      {isOr ? <path d={`M${x - 2} ${y} C${x + 12} ${y + 9}, ${x + 12} ${y + 21}, ${x - 2} ${y + 30} C${x + 26} ${y + 30}, ${x + 49} ${y + 23}, ${x + 61} ${y + 15} C${x + 49} ${y + 7}, ${x + 26} ${y}, ${x - 2} ${y} Z`} /> : null}
      {type === "XOR" ? <path d={`M${x - 10} ${y} C${x + 4} ${y + 9}, ${x + 4} ${y + 21}, ${x - 10} ${y + 30}`} /> : null}
      {inverted ? <circle cx={x + 61} cy={y + 15} r="4" /> : null}
    </>
  );
}

function SevenSegment({
  prefix,
  values,
  connectedPins,
  selectedPin,
  handlePinClick,
  disconnectPin,
  sourceHandlers,
  dragging,
  justDraggedRef
}: {
  prefix: "ANODE" | "CATHODE";
  values: Record<string, boolean>;
  connectedPins: Set<string>;
  selectedPin: string | null;
  handlePinClick: (pin: string) => void;
  disconnectPin: (pin: string) => void;
  sourceHandlers: (pin: string) => {
    onPointerDown: (event: PointerEvent<HTMLElement>) => void;
    onPointerMove: (event: PointerEvent<HTMLElement>) => void;
    onPointerUp: (event: PointerEvent<HTMLElement>) => void;
    onPointerCancel: () => void;
  };
  dragging: boolean;
  justDraggedRef: React.MutableRefObject<boolean>;
}) {
  const segs = ["a", "b", "c", "d", "e", "f", "g"] as const;
  const pins = [...segs, "dp"] as const;
  return (
    <div className="grid grid-cols-[80px_1fr] items-start gap-3">
      <div className="relative h-28 w-20 rounded-sm border-4 border-[#101010] bg-[#0a0a0a] shadow-inner">
        {segs.map((seg) => (
          <span
            key={seg}
            className={`absolute rounded-sm ${segmentClass(seg)} ${
              values[`${prefix}-${seg}`] ? "seven-seg-shadow bg-[#ff2424]" : "bg-[#351010]"
            }`}
          />
        ))}
        <span
          className={`absolute bottom-2 right-2 h-2.5 w-2.5 rounded-full ${
            values[`${prefix}-dp`] ? "bg-[#ff2424]" : "bg-[#351010]"
          }`}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        {pins.map((seg) => {
          const id = `${prefix}-${seg}`;
          const active = Boolean(values[id]);
          const isSelected = selectedPin === id;
          const isConnected = connectedPins.has(id);
          return (
            <div key={seg} className="flex items-center gap-2">
              <button
                type="button"
                data-pin-id={id}
                className={`pin-metal z-30 h-5 w-5 shrink-0 rounded-full transition-opacity ${
                  isConnected ? "ring-4 ring-[#ffd000]" : ""
                } ${isSelected ? "outline outline-4 outline-[#ffea00]" : ""} ${
                  dragging || isSelected || isConnected ? "opacity-100" : "opacity-60 hover:opacity-100"
                }`}
                style={
                  active
                    ? {
                        background:
                          "radial-gradient(circle at 35% 32%, #fff8b0 0 14%, #ffd000 34%, #bd8a00 68%, #5b3d00 100%)"
                      }
                    : undefined
                }
                aria-label={`${prefix} ${seg} connector`}
                onClick={(event) => {
                  event.stopPropagation();
                  if (justDraggedRef.current) {
                    justDraggedRef.current = false;
                    return;
                  }
                  if (isConnected) disconnectPin(id);
                  else handlePinClick(id);
                }}
                {...sourceHandlers(id)}
              />
              <span className="text-[11px] font-black uppercase text-[#111]">{seg}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function segmentClass(seg: string) {
  const map: Record<string, string> = {
    a: "left-[22px] top-[10px] h-2.5 w-9",
    g: "left-[22px] top-[51px] h-2.5 w-9",
    d: "left-[22px] bottom-[10px] h-2.5 w-9",
    b: "right-[11px] top-[18px] h-9 w-2.5",
    c: "right-[11px] bottom-[18px] h-9 w-2.5",
    f: "left-[11px] top-[18px] h-9 w-2.5",
    e: "left-[11px] bottom-[18px] h-9 w-2.5"
  };
  return map[seg];
}

const WireLayer = forwardRef<SVGSVGElement, {
  wires: Wire[];
  dragWire: { from: string; point: PinBox } | null;
  pinBoxes: Record<string, PinBox>;
  values: Record<string, boolean>;
}>(function WireLayer({ wires, dragWire, pinBoxes, values }, ref) {
  const dragging = Boolean(dragWire);
  return (
    <svg ref={ref} className="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-visible">
      <g style={{ opacity: dragging ? 1 : 0.55, transition: "opacity 120ms ease" }}>
        {wires.map((wire) => {
          const from = pinBoxes[wire.from];
          const to = pinBoxes[wire.to];
          if (!from || !to) return null;
          return <WirePath key={wire.id} from={from} to={to} color={values[wire.from] ? "#34ff61" : wire.color} />;
        })}
      </g>
      {dragWire && pinBoxes[dragWire.from] ? <WirePath from={pinBoxes[dragWire.from]} to={dragWire.point} color="#ffb000" preview /> : null}
    </svg>
  );
});

function WirePath({ from, to, color, preview = false }: { from: PinBox; to: PinBox; color: string; preview?: boolean }) {
  const dx = Math.max(54, Math.abs(to.x - from.x) * 0.42);
  const path = `M ${from.x} ${from.y} C ${from.x + dx} ${from.y - 18}, ${to.x - dx} ${to.y + 18}, ${to.x} ${to.y}`;
  return (
    <>
      <path d={path} fill="none" stroke="rgba(0,0,0,.45)" strokeWidth="10" strokeLinecap="round" transform="translate(3 3)" />
      <path d={path} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={preview ? "14 10" : undefined} />
      <path d={path} fill="none" stroke="rgba(255,255,255,.42)" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

function nearestCompatiblePin(clientX: number, clientY: number, from: string) {
  const wantInput = isSourcePin(from);
  const wantSource = isInputPin(from);
  let bestId: string | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  document.querySelectorAll<HTMLElement>("[data-pin-id]").forEach((node) => {
    const id = node.dataset.pinId;
    if (!id || id === from) return;
    if (wantInput && !isInputPin(id)) return;
    if (wantSource && !isSourcePin(id)) return;
    const rect = node.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const distance = Math.hypot(clientX - x, clientY - y);
    if (distance <= 64 && distance < bestDistance) {
      bestId = id;
      bestDistance = distance;
    }
  });
  return bestId;
}

function resolveConnection(first: string, second: string) {
  if (isSourcePin(first) && isInputPin(second)) return { from: first, to: second };
  if (isInputPin(first) && isSourcePin(second)) return { from: second, to: first };
  return null;
}

function isSourcePin(pin: string) {
  return (
    pin.startsWith("DIP") ||
    pin.startsWith("SLIDE") ||
    pin.startsWith("BTN") ||
    pin.startsWith("PU") ||
    pin === "PULSE" ||
    pin.includes(":O")
  );
}

function isInputPin(pin: string) {
  return pin.includes(":I") || pin.startsWith("LED") || pin.startsWith("ANODE") || pin.startsWith("CATHODE");
}

function labelPin(pin: string) {
  return pin.replace("MOD:", "").replace(":I", " input ").replace(":O", " output ");
}

function valueFromWire(pin: string, wires: Wire[], values: Record<string, boolean>) {
  const wire = wires.find((item) => item.to === pin);
  return wire ? Boolean(values[wire.from]) : false;
}

function evaluateModule(module: PlacedModule, input: boolean[], memory: Record<string, number>, pulse: boolean) {
  switch (module.type) {
    case "NOR":
      return [!(input[0] || input[1]), !(input[2] || input[3])];
    case "NAND":
      return [!(input[0] && input[1]), !(input[2] && input[3])];
    case "NOT":
      return [!input[0], !input[1]];
    case "AND":
      return [input[0] && input[1], input[2] && input[3]];
    case "OR":
      return [input[0] || input[1], input[2] || input[3]];
    case "XOR":
      return [input[0] !== input[1], input[2] !== input[3]];
    case "NAND3":
      return [!input.slice(0, 3).every(Boolean), !input.slice(3, 6).every(Boolean)];
    case "NAND4":
      return [!input.slice(0, 4).every(Boolean), !input.slice(4, 8).every(Boolean)];
    case "DECODER7442": {
      const n = bitsToNumber(input);
      return Array.from({ length: 10 }, (_, value) => n === value);
    }
    case "SEG7447":
      return sevenSegment(bitsToNumber(input));
    case "LATCH7475":
      return input.slice(4, 8).map((enable, index) => (enable ? input[index] : Boolean(memory[`${module.instanceId}:${index}`])));
    case "ADDER7483":
      return numberToBits(bitsToNumber(input.slice(0, 4)) + bitsToNumber(input.slice(4, 8)) + Number(input[8]), 5);
    case "COMP7485": {
      const a = bitsToNumber(input.slice(0, 4));
      const b = bitsToNumber(input.slice(4, 8));
      const cascadeGreater = input[8];
      const cascadeLess = input[9];
      return [a > b || (a === b && cascadeGreater), a === b && !cascadeGreater && !cascadeLess, a < b || (a === b && cascadeLess)];
    }
    case "COUNTER7490":
      return numberToBits(memory[module.instanceId] || 0, 4);
    case "COUNTER74393":
      return numberToBits(memory[module.instanceId] || 0, 4);
    case "JK7473":
      return [Boolean(memory[module.instanceId]), !memory[module.instanceId]];
    case "D7474":
      return [input[1] ? input[0] : Boolean(memory[module.instanceId]), !(input[1] ? input[0] : Boolean(memory[module.instanceId]))];
    case "TIMER555":
      return [pulse];
    case "ASTABLE":
      return [pulse, !pulse];
    case "HALF_ADDER":
      return [input[0] !== input[1], input[0] && input[1]];
    case "HALF_SUB":
      return [input[0] !== input[1], !input[0] && input[1]];
    default:
      return [false];
  }
}

function bitsToNumber(bits: boolean[]) {
  return bits.reduce((sum, bit, index) => sum + (bit ? 2 ** index : 0), 0);
}

function numberToBits(value: number, width: number) {
  return Array.from({ length: width }, (_, index) => Boolean(value & (1 << index)));
}

function sevenSegment(value: number) {
  const table = [
    [1, 1, 1, 1, 1, 1, 0],
    [0, 1, 1, 0, 0, 0, 0],
    [1, 1, 0, 1, 1, 0, 1],
    [1, 1, 1, 1, 0, 0, 1],
    [0, 1, 1, 0, 0, 1, 1],
    [1, 0, 1, 1, 0, 1, 1],
    [1, 0, 1, 1, 1, 1, 1],
    [1, 1, 1, 0, 0, 0, 0],
    [1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 0, 1, 1]
  ];
  return (table[value % 10] || table[0]).map(Boolean);
}

export function useTrainerState() {
  const context = useContext(TrainerContext);
  if (!context) throw new Error("useTrainerState must be used inside LogicTrainer");
  return context;
}

(function () {
  "use strict";

  const groups = [
    {
      title: "Basic Gates",
      items: [
        ["7400", "NAND", 6, "Dual NAND Gate"],
        ["7402", "NOR", 2, "Dual NOR Gate"],
        ["7404", "NOT", 3, "Dual NOT Gate"],
        ["7408", "AND", 2, "Dual AND Gate"],
        ["7410", "NAND3", 2, "Dual 3-input NAND"],
        ["7420", "NAND4", 1, "Dual 4-input NAND"],
        ["7432", "OR", 2, "Dual OR Gate"],
        ["7486", "XOR", 5, "Dual XOR Gate"]
      ]
    },
    {
      title: "74 Series Chips",
      items: [
        ["7442", "DECIMAL_DECODER", 1, "Decimal Decoder"],
        ["7447", "SEG_DECODER", 1, "7-Segment Decoder"],
        ["7475", "LATCH", 1, "4-Bit Latch"],
        ["7483", "ADDER", 1, "4-Bit Full Adder"],
        ["7485", "COMPARATOR", 1, "4-Bit Comparator"],
        ["7490", "DECADE_COUNTER", 1, "Decimal Counter"]
      ]
    },
    {
      title: "Registers",
      items: [
        ["74393", "BINARY_COUNTER", 1, "4-Bit Binary Counter"],
        ["7473", "JK", 2, "Dual JK Flip Flop"],
        ["7474", "DFF", 2, "Dual D Flip Flop"]
      ]
    },
    {
      title: "Application Circuits",
      items: [
        ["NE555", "TIMER", 1, "Timer Module"],
        ["2SC1815", "ASTABLE", 2, "Multivibrator 1"],
        ["2SC1266", "ASTABLE2", 1, "Multivibrator 2"]
      ]
    }
  ];

  const state = {
    powered: false,
    inputs: {},
    modules: {},
    slots: Array(16).fill(null),
    wires: [],
    nodeValues: {},
    dragWire: null,
    pulse: false,
    pulseHz: 2,
    tick: 0
  };

  const el = {
    body: document.body,
    library: document.getElementById("componentLibrary"),
    grid: document.getElementById("moduleGrid"),
    wires: document.getElementById("wireLayer"),
    power: document.getElementById("powerSwitch"),
    powerLabel: document.getElementById("powerLabel"),
    status: document.getElementById("statusText"),
    wireCount: document.getElementById("wireCount"),
    pulseRate: document.getElementById("pulseRate"),
    pulseValue: document.getElementById("pulseValue")
  };

  const inputNodes = [];
  const outputNodes = [];
  const segmentNodes = { anode: [], cathode: [] };

  function uid(prefix) {
    return `${prefix}-${Math.random().toString(16).slice(2, 9)}`;
  }

  function init() {
    renderLibrary();
    renderRails();
    renderInputs();
    renderOutputs();
    renderGrid();
    bindGlobalEvents();
    startClock();
    evaluate();
  }

  function renderLibrary() {
    el.library.innerHTML = "";
    groups.forEach((group) => {
      const wrapper = document.createElement("section");
      wrapper.className = "lib-group";
      wrapper.innerHTML = `<div class="lib-heading">${group.title}</div>`;
      group.items.forEach(([chip, type, qty, desc]) => {
        const card = document.createElement("div");
        card.className = "chip-card";
        card.draggable = true;
        card.dataset.type = type;
        card.dataset.chip = chip;
        card.dataset.desc = desc;
        card.dataset.remaining = qty;
        card.innerHTML = `
          <div>
            <span class="chip-name">${chip} <b data-count>${qty}</b>x</span>
            <span class="chip-desc">${desc}</span>
          </div>
          <button type="button" aria-label="Add ${chip}">+</button>
        `;
        card.addEventListener("dragstart", (event) => {
          if (Number(card.dataset.remaining) < 1) {
            event.preventDefault();
            return;
          }
          event.dataTransfer.setData("application/json", JSON.stringify({ type, chip, desc }));
        });
        card.querySelector("button").addEventListener("click", () => {
          const slot = state.slots.findIndex((value) => !value);
          if (slot >= 0) placeModule(slot, { type, chip, desc }, card);
        });
        wrapper.appendChild(card);
      });
      el.library.appendChild(wrapper);
    });
  }

  function renderRails() {
    renderResistors("pullUps", "PU", true);
    renderResistors("pullDowns", "PD", false);
  }

  function renderResistors(containerId, prefix, value) {
    const container = document.getElementById(containerId);
    for (let i = 0; i < 16; i += 1) {
      const node = `${prefix}${i}`;
      state.inputs[node] = value;
      inputNodes.push(node);
      const item = document.createElement("div");
      item.className = "resistor";
      item.innerHTML = `<div class="node-row"><span class="pin source-pin" data-kind="source" data-node="${node}" tabindex="0"></span><span class="pin-label">${prefix}${i + 1}</span></div>`;
      container.appendChild(item);
    }
  }

  function renderInputs() {
    const dip = document.getElementById("dipSwitches");
    for (let bank = 0; bank < 4; bank += 1) {
      for (let bit = 0; bit < 8; bit += 1) {
        const node = `DIP${bank + 1}-${bit}`;
        state.inputs[node] = false;
        inputNodes.push(node);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "dip";
        button.dataset.node = node;
        button.setAttribute("aria-label", `${node} switch`);
        button.innerHTML = `<span></span><i class="pin source-pin" data-kind="source" data-node="${node}" tabindex="0"></i>`;
        button.addEventListener("click", () => toggleInput(node, button));
        dip.appendChild(button);
      }
    }

    const slides = document.getElementById("slideSwitches");
    for (let i = 0; i < 12; i += 1) {
      const node = `SW${i + 1}`;
      state.inputs[node] = false;
      inputNodes.push(node);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "slide";
      button.dataset.node = node;
      button.setAttribute("aria-label", `${node} slide switch`);
      button.innerHTML = `<span></span><i class="pin source-pin" data-kind="source" data-node="${node}" tabindex="0"></i>`;
      button.addEventListener("click", () => toggleInput(node, button));
      slides.appendChild(button);
    }

    const push = document.getElementById("buttonSwitches");
    for (let i = 0; i < 4; i += 1) {
      const node = `BTN${i + 1}`;
      state.inputs[node] = false;
      inputNodes.push(node);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "push-button";
      button.dataset.node = node;
      button.setAttribute("aria-label", `${node} push button`);
      button.innerHTML = `<i class="pin source-pin" data-kind="source" data-node="${node}" tabindex="0"></i>`;
      button.addEventListener("pointerdown", () => setInput(node, true, button));
      button.addEventListener("pointerup", () => setInput(node, false, button));
      button.addEventListener("pointerleave", () => setInput(node, false, button));
      push.appendChild(button);
    }

    inputNodes.push("PULSE");
  }

  function renderOutputs() {
    const bank = document.getElementById("ledBank");
    for (let i = 0; i < 16; i += 1) {
      const node = `LED${i + 1}`;
      outputNodes.push(node);
      const cell = document.createElement("div");
      cell.className = "led-cell";
      cell.innerHTML = `
        <span class="led" data-led="${node}"></span>
        <span class="node-row"><span class="target-pin pin" data-kind="target" data-node="${node}" tabindex="0"></span><span class="led-label">${i + 1}</span></span>
      `;
      bank.appendChild(cell);
    }

    ["anode", "cathode"].forEach((common) => {
      const seg = document.getElementById(common === "anode" ? "segAnode" : "segCathode");
      ["a", "b", "c", "d", "e", "f", "g"].forEach((name) => {
        const part = document.createElement("span");
        part.className = `seg ${name}`;
        part.dataset.seg = `${common}-${name}`;
        seg.appendChild(part);
      });
      const dot = document.createElement("span");
      dot.className = "seg-dot";
      dot.dataset.seg = `${common}-dp`;
      seg.appendChild(dot);
      const pinRow = document.createElement("div");
      pinRow.className = "seg-pin-row";
      ["a", "b", "c", "d", "e", "f", "g", "dp"].forEach((name) => {
        const node = `${common.toUpperCase()}-${name}`;
        segmentNodes[common].push(node);
        const pin = document.createElement("span");
        pin.className = "pin target-pin";
        pin.dataset.kind = "target";
        pin.dataset.node = node;
        pin.title = node;
        pin.tabIndex = 0;
        pinRow.appendChild(pin);
      });
      seg.parentElement.appendChild(pinRow);
    });
  }

  function renderGrid() {
    for (let i = 0; i < 16; i += 1) {
      const slot = document.createElement("div");
      slot.className = "slot";
      slot.dataset.slot = i;
      slot.addEventListener("dragover", (event) => {
        event.preventDefault();
        slot.classList.add("drag-over");
      });
      slot.addEventListener("dragleave", () => slot.classList.remove("drag-over"));
      slot.addEventListener("drop", (event) => {
        event.preventDefault();
        slot.classList.remove("drag-over");
        if (state.slots[i]) return;
        const data = JSON.parse(event.dataTransfer.getData("application/json"));
        const card = findLibraryCard(data.chip);
        placeModule(i, data, card);
      });
      el.grid.appendChild(slot);
    }
  }

  function placeModule(slotIndex, data, card) {
    if (!card || Number(card.dataset.remaining) < 1 || state.slots[slotIndex]) return;
    const id = uid(data.chip);
    const io = moduleIo(data.type);
    state.modules[id] = {
      id,
      ...data,
      slot: slotIndex,
      inputs: Array(io.inputs).fill(false),
      outputs: Array(io.outputs).fill(false),
      memory: 0
    };
    state.slots[slotIndex] = id;
    card.dataset.remaining = String(Number(card.dataset.remaining) - 1);
    card.querySelector("[data-count]").textContent = card.dataset.remaining;
    renderModule(id);
    setStatus(`${data.chip} installed in block ${slotIndex + 1}.`);
    evaluate();
  }

  function moduleIo(type) {
    const map = {
      NAND: [4, 2],
      NOR: [4, 2],
      NOT: [2, 2],
      AND: [4, 2],
      NAND3: [6, 2],
      NAND4: [8, 2],
      OR: [4, 2],
      XOR: [4, 2],
      DECIMAL_DECODER: [4, 4],
      SEG_DECODER: [4, 7],
      LATCH: [4, 4],
      ADDER: [4, 4],
      COMPARATOR: [4, 3],
      DECADE_COUNTER: [1, 4],
      BINARY_COUNTER: [1, 4],
      JK: [3, 1],
      DFF: [2, 1],
      TIMER: [1, 1],
      ASTABLE: [1, 2],
      ASTABLE2: [1, 2]
    };
    const [inputs, outputs] = map[type] || [2, 1];
    return { inputs, outputs };
  }

  function renderModule(id) {
    const mod = state.modules[id];
    const slot = el.grid.querySelector(`[data-slot="${mod.slot}"]`);
    const module = document.createElement("article");
    module.className = "module";
    module.dataset.module = id;
    module.innerHTML = `
      <div class="module-head"><span>${mod.chip}</span><span class="module-chip">${mod.desc}</span></div>
      <div class="module-body">${symbolFor(mod.type)}</div>
      <div class="module-led-row">${mod.outputs.map((_, index) => `<span class="tiny-led" data-module-led="${id}:O${index}"></span>`).join("")}</div>
    `;
    for (let i = 0; i < mod.inputs.length; i += 1) {
      const pin = document.createElement("span");
      pin.className = "pin in target-pin";
      pin.dataset.kind = "target";
      pin.dataset.node = `${id}:I${i}`;
      pin.title = `I${i + 1}`;
      pin.tabIndex = 0;
      pin.style.top = `${24 + i * Math.min(18, 56 / Math.max(1, mod.inputs.length - 1))}%`;
      module.appendChild(pin);
    }
    for (let i = 0; i < mod.outputs.length; i += 1) {
      const pin = document.createElement("span");
      pin.className = "pin out source-pin";
      pin.dataset.kind = "source";
      pin.dataset.node = `${id}:O${i}`;
      pin.title = `O${i + 1}`;
      pin.tabIndex = 0;
      pin.style.top = `${mod.outputs.length === 1 ? 50 : 18 + i * (64 / (mod.outputs.length - 1))}%`;
      module.appendChild(pin);
    }
    slot.appendChild(module);
  }

  function symbolFor(type) {
    const symbols = {
      NAND: "&uparrow;",
      NOR: "&downarrow;",
      NOT: "NOT",
      AND: "AND",
      NAND3: "3-NAND",
      NAND4: "4-NAND",
      OR: "OR",
      XOR: "XOR",
      DECIMAL_DECODER: "BCD→10",
      SEG_DECODER: "BCD→7SEG",
      LATCH: "LATCH",
      ADDER: "A+B",
      COMPARATOR: "A:B",
      DECADE_COUNTER: "÷10",
      BINARY_COUNTER: "÷16",
      JK: "JK",
      DFF: "D",
      TIMER: "555",
      ASTABLE: "MV",
      ASTABLE2: "MV2"
    };
    return symbols[type] || type;
  }

  function bindGlobalEvents() {
    el.power.addEventListener("click", () => {
      state.powered = !state.powered;
      document.body.classList.toggle("powered", state.powered);
      el.power.setAttribute("aria-pressed", String(state.powered));
      el.powerLabel.textContent = state.powered ? "POWER ON" : "POWER OFF";
      setStatus(state.powered ? "Power is on. Simulation is evaluating in real time." : "Power is off. Outputs are forced low.");
      evaluate();
    });

    document.getElementById("clearBoard").addEventListener("click", clearBoard);
    el.pulseRate.addEventListener("input", () => {
      state.pulseHz = Number(el.pulseRate.value);
      el.pulseValue.textContent = state.pulseHz.toFixed(state.pulseHz < 10 ? 1 : 0);
    });

    document.addEventListener("pointerdown", (event) => {
      const pin = event.target.closest(".source-pin");
      if (!pin) return;
      state.dragWire = { from: pin.dataset.node, x: event.clientX, y: event.clientY };
      drawWires(event);
    });
    document.addEventListener("pointermove", (event) => {
      if (!state.dragWire) return;
      state.dragWire.x = event.clientX;
      state.dragWire.y = event.clientY;
      drawWires(event);
    });
    document.addEventListener("pointerup", (event) => {
      if (!state.dragWire) return;
      const target = event.target.closest(".target-pin");
      if (target && target.dataset.node !== state.dragWire.from) {
        connect(state.dragWire.from, target.dataset.node);
      }
      state.dragWire = null;
      drawWires();
    });

    window.addEventListener("resize", drawWires);
  }

  function connect(from, to) {
    state.wires = state.wires.filter((wire) => wire.to !== to);
    state.wires.push({ id: uid("wire"), from, to });
    setStatus(`Connected ${from} to ${to}.`);
    evaluate();
  }

  function toggleInput(node, button) {
    setInput(node, !state.inputs[node], button);
  }

  function setInput(node, value, button) {
    state.inputs[node] = value;
    if (button) button.classList.toggle("on", value);
    evaluate();
  }

  function startClock() {
    let last = performance.now();
    function loop(now) {
      const period = 500 / Math.max(0.2, state.pulseHz);
      if (now - last >= period) {
        state.pulse = !state.pulse;
        state.tick += 1;
        last = now;
        evaluate();
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  function evaluate() {
    const values = {};
    inputNodes.forEach((node) => {
      values[node] = state.powered && (node === "PULSE" ? state.pulse : Boolean(state.inputs[node]));
    });

    for (let pass = 0; pass < 8; pass += 1) {
      Object.values(state.modules).forEach((mod) => {
        mod.inputs = mod.inputs.map((_, index) => valueFromWire(`${mod.id}:I${index}`, values));
        mod.outputs = computeModule(mod);
        mod.outputs.forEach((value, index) => {
          values[`${mod.id}:O${index}`] = state.powered && value;
        });
      });
    }

    outputNodes.forEach((node) => {
      values[node] = state.powered && valueFromWire(node, values);
    });
    Object.values(segmentNodes).flat().forEach((node) => {
      values[node] = state.powered && valueFromWire(node, values);
    });

    state.nodeValues = values;
    paintState();
    drawWires();
  }

  function valueFromWire(target, values) {
    const wire = state.wires.find((item) => item.to === target);
    return wire ? Boolean(values[wire.from]) : false;
  }

  function computeModule(mod) {
    if (!state.powered) return mod.outputs.map(() => false);
    const input = mod.inputs.map(Boolean);
    switch (mod.type) {
      case "NAND":
        return [!(input[0] && input[1]), !(input[2] && input[3])];
      case "NOR":
        return [!(input[0] || input[1]), !(input[2] || input[3])];
      case "NOT":
        return [!input[0], !input[1]];
      case "AND":
        return [input[0] && input[1], input[2] && input[3]];
      case "NAND3":
        return [!input.slice(0, 3).every(Boolean), !input.slice(3, 6).every(Boolean)];
      case "NAND4":
        return [!input.slice(0, 4).every(Boolean), !input.slice(4, 8).every(Boolean)];
      case "OR":
        return [input[0] || input[1], input[2] || input[3]];
      case "XOR":
        return [Boolean(input[0]) !== Boolean(input[1]), Boolean(input[2]) !== Boolean(input[3])];
      case "DECIMAL_DECODER": {
        const n = bitsToNumber(input);
        return [0, 1, 2, 3].map((i) => n === i);
      }
      case "SEG_DECODER":
        return sevenSegment(bitsToNumber(input));
      case "LATCH":
        mod.memory = bitsToNumber(input);
        return numberToBits(mod.memory, 4);
      case "ADDER":
        return numberToBits((bitsToNumber(input.slice(0, 2)) + bitsToNumber(input.slice(2, 4))) & 15, 4);
      case "COMPARATOR": {
        const a = bitsToNumber(input.slice(0, 2));
        const b = bitsToNumber(input.slice(2, 4));
        return [a > b, a === b, a < b];
      }
      case "DECADE_COUNTER":
        if (input[0]) mod.memory = state.tick % 10;
        return numberToBits(mod.memory, 4);
      case "BINARY_COUNTER":
        if (input[0]) mod.memory = state.tick % 16;
        return numberToBits(mod.memory, 4);
      case "JK":
        if (input[2]) mod.memory = input[0] && input[1] ? Number(!mod.memory) : input[0] ? 1 : input[1] ? 0 : mod.memory;
        return [Boolean(mod.memory)];
      case "DFF":
        if (input[1]) mod.memory = Number(input[0]);
        return [Boolean(mod.memory)];
      case "TIMER":
        return [state.pulse];
      case "ASTABLE":
      case "ASTABLE2":
        return [state.pulse, !state.pulse];
      default:
        return [false];
    }
  }

  function bitsToNumber(bits) {
    return bits.reduce((sum, bit, index) => sum + (bit ? 2 ** index : 0), 0);
  }

  function numberToBits(number, width) {
    return Array.from({ length: width }, (_, index) => Boolean(number & (1 << index)));
  }

  function sevenSegment(number) {
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
    return (table[number % 10] || table[0]).map(Boolean);
  }

  function paintState() {
    document.querySelectorAll(".pin").forEach((pin) => {
      pin.classList.toggle("hot", Boolean(state.nodeValues[pin.dataset.node]));
    });
    document.querySelectorAll("[data-module-led]").forEach((led) => {
      const node = led.dataset.moduleLed;
      led.classList.toggle("on", Boolean(state.nodeValues[node]));
    });
    outputNodes.forEach((node) => {
      const led = document.querySelector(`[data-led="${node}"]`);
      if (led) led.classList.toggle("on", Boolean(state.nodeValues[node]));
    });
    ["anode", "cathode"].forEach((common) => {
      ["a", "b", "c", "d", "e", "f", "g", "dp"].forEach((name) => {
        const node = `${common.toUpperCase()}-${name}`;
        const segment = document.querySelector(`[data-seg="${common}-${name}"]`);
        if (segment) segment.classList.toggle("on", Boolean(state.nodeValues[node]));
      });
    });
    el.wireCount.textContent = `${state.wires.length} ${state.wires.length === 1 ? "wire" : "wires"}`;
  }

  function drawWires(event) {
    const board = document.querySelector(".board-frame").getBoundingClientRect();
    el.wires.setAttribute("viewBox", `0 0 ${board.width} ${board.height}`);
    el.wires.innerHTML = "";
    state.wires.forEach((wire) => {
      const from = pinCenter(wire.from, board);
      const to = pinCenter(wire.to, board);
      if (!from || !to) return;
      el.wires.appendChild(pathFor(from, to, Boolean(state.nodeValues[wire.from])));
    });
    if (state.dragWire) {
      const from = pinCenter(state.dragWire.from, board);
      const to = { x: state.dragWire.x - board.left, y: state.dragWire.y - board.top };
      if (from) {
        const path = pathFor(from, to, false);
        path.classList.add("preview");
        el.wires.appendChild(path);
      }
    }
  }

  function pinCenter(node, board) {
    const pin = document.querySelector(`.pin[data-node="${cssEscape(node)}"]`);
    if (!pin) return null;
    const rect = pin.getBoundingClientRect();
    return {
      x: rect.left - board.left + rect.width / 2,
      y: rect.top - board.top + rect.height / 2
    };
  }

  function pathFor(from, to, on) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("class", `wire-path${on ? " on" : ""}`);
    const mid = from.x + (to.x - from.x) / 2;
    path.setAttribute("d", `M ${from.x} ${from.y} L ${mid} ${from.y} L ${mid} ${to.y} L ${to.x} ${to.y}`);
    return path;
  }

  function clearBoard() {
    Object.values(state.modules).forEach((mod) => {
      const card = findLibraryCard(mod.chip);
      if (card) {
        card.dataset.remaining = String(Number(card.dataset.remaining) + 1);
        card.querySelector("[data-count]").textContent = card.dataset.remaining;
      }
    });
    state.modules = {};
    state.slots = Array(16).fill(null);
    state.wires = [];
    document.querySelectorAll(".module").forEach((module) => module.remove());
    setStatus("Board cleared.");
    evaluate();
  }

  function findLibraryCard(chip) {
    return el.library.querySelector(`.chip-card[data-chip="${cssEscape(chip)}"]`);
  }

  function setStatus(message) {
    el.status.textContent = message;
  }

  function cssEscape(value) {
    if (window.CSS && CSS.escape) return CSS.escape(value);
    return String(value).replace(/["\\]/g, "\\$&");
  }

  init();
})();

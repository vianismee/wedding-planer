/* eslint-disable */
// @ts-nocheck
// Dari 21st.dev (arikchakma/cromia-color-picker). Kode hasil bundel Cromia, disalin apa adanya.
// Perubahan lokal: primitifnya ikut diekspor sebagai `ColorPicker` (lihat bagian export di bawah),
// karena CromiaColorPicker bawaan tidak punya onChange. Pemakaian terkontrol ada di components/color-field.tsx.
"use client";

import * as React2 from "react";
import { createElement as createElement2 } from "react";
import { jsx } from "react/jsx-runtime";
import { c } from "react/compiler-runtime";
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
  let target = {};
  for (var name in all) __defProp(target, name, {
    get: all[name],
    enumerable: true
  });
  if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
  return target;
};
function mergeObjects(a, b) {
  if (a && !b) return a;
  if (!a && b) return b;
  if (a || b) return {
    ...a,
    ...b
  };
}
var EMPTY_PROPS = {};
function mergeProps(a, b, c2, d, e) {
  let merged = { ...resolvePropsGetter(a, EMPTY_PROPS) };
  if (b) merged = mergeOne(merged, b);
  if (c2) merged = mergeOne(merged, c2);
  if (d) merged = mergeOne(merged, d);
  if (e) merged = mergeOne(merged, e);
  return merged;
}
function mergePropsN(props) {
  if (props.length === 0) return EMPTY_PROPS;
  if (props.length === 1) return resolvePropsGetter(props[0], EMPTY_PROPS);
  let merged = { ...resolvePropsGetter(props[0], EMPTY_PROPS) };
  for (let i = 1; i < props.length; i += 1) merged = mergeOne(merged, props[i]);
  return merged;
}
function mergeOne(merged, inputProps) {
  if (isPropsGetter(inputProps)) return inputProps(merged);
  return mutablyMergeInto(merged, inputProps);
}
function mutablyMergeInto(mergedProps, externalProps) {
  if (!externalProps) return mergedProps;
  for (const propName in externalProps) {
    const externalPropValue = externalProps[propName];
    switch (propName) {
      case "style":
        mergedProps[propName] = mergeObjects(mergedProps.style, externalPropValue);
        break;
      case "className":
        mergedProps[propName] = mergeClassNames(mergedProps.className, externalPropValue);
        break;
      default:
        if (isEventHandler(propName, externalPropValue)) mergedProps[propName] = mergeEventHandlers(mergedProps[propName], externalPropValue);
        else mergedProps[propName] = externalPropValue;
    }
  }
  return mergedProps;
}
function isEventHandler(key, value) {
  const code0 = key.charCodeAt(0);
  const code1 = key.charCodeAt(1);
  const code2 = key.charCodeAt(2);
  return code0 === 111 && code1 === 110 && code2 >= 65 && code2 <= 90 && (typeof value === "function" || typeof value === "undefined");
}
function isPropsGetter(inputProps) {
  return typeof inputProps === "function";
}
function resolvePropsGetter(inputProps, previousProps) {
  if (isPropsGetter(inputProps)) return inputProps(previousProps);
  return inputProps ?? EMPTY_PROPS;
}
function mergeEventHandlers(ourHandler, theirHandler) {
  if (!theirHandler) return ourHandler;
  if (!ourHandler) return theirHandler;
  return (event) => {
    if (isSyntheticEvent(event)) {
      const baseUIEvent = event;
      makeEventPreventable(baseUIEvent);
      const result2 = theirHandler(baseUIEvent);
      if (!baseUIEvent.baseUIHandlerPrevented) ourHandler?.(baseUIEvent);
      return result2;
    }
    const result = theirHandler(event);
    ourHandler?.(event);
    return result;
  };
}
function makeEventPreventable(event) {
  event.preventBaseUIHandler = () => {
    event.baseUIHandlerPrevented = true;
  };
  return event;
}
function mergeClassNames(ourClassName, theirClassName) {
  if (theirClassName) {
    if (ourClassName) return theirClassName + " " + ourClassName;
    return theirClassName;
  }
  return ourClassName;
}
function isSyntheticEvent(event) {
  return event != null && typeof event === "object" && "nativeEvent" in event;
}
var UNINITIALIZED = {};
function useRefWithInit(init, initArg) {
  const ref = React2.useRef(UNINITIALIZED);
  if (ref.current === UNINITIALIZED) ref.current = init(initArg);
  return ref;
}
function useMergedRefs(a, b, c2, d) {
  const forkRef = useRefWithInit(createForkRef).current;
  if (didChange(forkRef, a, b, c2, d)) update(forkRef, [
    a,
    b,
    c2,
    d
  ]);
  return forkRef.callback;
}
function useMergedRefsN(refs) {
  const forkRef = useRefWithInit(createForkRef).current;
  if (didChangeN(forkRef, refs)) update(forkRef, refs);
  return forkRef.callback;
}
function createForkRef() {
  return {
    callback: null,
    cleanup: null,
    refs: []
  };
}
function didChange(forkRef, a, b, c2, d) {
  return forkRef.refs[0] !== a || forkRef.refs[1] !== b || forkRef.refs[2] !== c2 || forkRef.refs[3] !== d;
}
function didChangeN(forkRef, newRefs) {
  return forkRef.refs.length !== newRefs.length || forkRef.refs.some((ref, index) => ref !== newRefs[index]);
}
function update(forkRef, refs) {
  forkRef.refs = refs;
  if (refs.every((ref) => ref == null)) {
    forkRef.callback = null;
    return;
  }
  forkRef.callback = (instance) => {
    if (forkRef.cleanup) {
      forkRef.cleanup();
      forkRef.cleanup = null;
    }
    if (instance != null) {
      const cleanupCallbacks = Array(refs.length).fill(null);
      for (let i = 0; i < refs.length; i += 1) {
        const ref = refs[i];
        if (ref == null) continue;
        switch (typeof ref) {
          case "function": {
            const refCleanup = ref(instance);
            if (typeof refCleanup === "function") cleanupCallbacks[i] = refCleanup;
            break;
          }
          case "object":
            ref.current = instance;
            break;
          default:
        }
      }
      forkRef.cleanup = () => {
        for (let i = 0; i < refs.length; i += 1) {
          const ref = refs[i];
          if (ref == null) continue;
          switch (typeof ref) {
            case "function": {
              const cleanupCallback = cleanupCallbacks[i];
              if (typeof cleanupCallback === "function") cleanupCallback();
              else ref(null);
              break;
            }
            case "object":
              ref.current = null;
              break;
            default:
          }
        }
      };
    }
  };
}
var majorVersion = parseInt(React2.version, 10);
function isReactVersionAtLeast(reactVersionToCheck) {
  return majorVersion >= reactVersionToCheck;
}
function getReactElementRef(element) {
  if (!/* @__PURE__ */ React2.isValidElement(element)) return null;
  const reactElement = element;
  const propsWithRef = reactElement.props;
  return (isReactVersionAtLeast(19) ? propsWithRef?.ref : reactElement.ref) ?? null;
}
function getStateAttributesProps(state, customMapping) {
  const props = {};
  for (const key in state) {
    const value = state[key];
    if (customMapping?.hasOwnProperty(key)) {
      const customProps = customMapping[key](value);
      if (customProps != null) Object.assign(props, customProps);
      continue;
    }
    if (value === true) props[`data-${key.toLowerCase()}`] = "";
    else if (value) props[`data-${key.toLowerCase()}`] = value.toString();
  }
  return props;
}
function resolveClassName(className, state) {
  return typeof className === "function" ? className(state) : className;
}
function resolveStyle(style, state) {
  return typeof style === "function" ? style(state) : style;
}
Object.freeze([]);
var EMPTY_OBJECT = Object.freeze({});
function useRenderElement(element, componentProps, params = {}) {
  const renderProp = componentProps.render;
  const outProps = useRenderElementProps(componentProps, params);
  if (params.enabled === false) return null;
  return evaluateRenderProp(element, renderProp, outProps, params.state ?? EMPTY_OBJECT);
}
function useRenderElementProps(componentProps, params = {}) {
  const { className: classNameProp, style: styleProp, render: renderProp } = componentProps;
  const { state = EMPTY_OBJECT, ref, props, stateAttributesMapping, enabled = true } = params;
  const className = enabled ? resolveClassName(classNameProp, state) : void 0;
  const style = enabled ? resolveStyle(styleProp, state) : void 0;
  const stateProps = enabled ? getStateAttributesProps(state, stateAttributesMapping) : EMPTY_OBJECT;
  const outProps = enabled ? mergeObjects(stateProps, Array.isArray(props) ? mergePropsN(props) : props) ?? EMPTY_OBJECT : EMPTY_OBJECT;
  if (typeof document !== "undefined") if (!enabled) useMergedRefs(null, null);
  else if (Array.isArray(ref)) outProps.ref = useMergedRefsN([
    outProps.ref,
    getReactElementRef(renderProp),
    ...ref
  ]);
  else outProps.ref = useMergedRefs(outProps.ref, getReactElementRef(renderProp), ref);
  if (!enabled) return EMPTY_OBJECT;
  if (className !== void 0) outProps.className = mergeClassNames(outProps.className, className);
  if (style !== void 0) outProps.style = mergeObjects(outProps.style, style);
  return outProps;
}
function evaluateRenderProp(element, render, props, state) {
  if (render) {
    if (typeof render === "function") return render(props, state);
    const mergedProps = mergeProps(props, render.props);
    mergedProps.ref = props.ref;
    return /* @__PURE__ */ React2.cloneElement(render, mergedProps);
  }
  if (element) {
    if (typeof element === "string") return renderTag(element, props);
  }
  throw new Error(true ? "Base UI: Render element or function are not defined." : formatErrorMessage(8));
}
function renderTag(Tag, props) {
  if (Tag === "button") return /* @__PURE__ */ createElement2("button", {
    type: "button",
    ...props,
    key: props.key
  });
  if (Tag === "img") return /* @__PURE__ */ createElement2("img", {
    alt: "",
    ...props,
    key: props.key
  });
  return /* @__PURE__ */ React2.createElement(Tag, props);
}
function useRender(params) {
  return useRenderElement(params.defaultTagName ?? "div", params, params);
}
var noop$1 = () => {
};
var useIsoLayoutEffect = typeof document !== "undefined" ? React2.useLayoutEffect : noop$1;
function useValueAsRef(value) {
  const latest = useRefWithInit(createLatestRef, value).current;
  latest.next = value;
  useIsoLayoutEffect(latest.effect);
  return latest;
}
function createLatestRef(value) {
  const latest = {
    current: value,
    next: value,
    effect: () => {
      latest.current = latest.next;
    }
  };
  return latest;
}
var bool = (name) => {
  return (value) => value ? { [`data-${name}`]: "" } : null;
};
function isObjectDeepEqual(first, second) {
  const keysA = Object.keys(first);
  const keysB = Object.keys(second);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    const a = first[key];
    const b = second[key];
    if (typeof a === "object" && a !== null && typeof b === "object" && b !== null) {
      if (!isObjectDeepEqual(a, b)) return false;
    } else if (a !== b) return false;
  }
  return true;
}
function isAnyColorEqual(a, b) {
  if (a === b) return true;
  if (a === void 0 || b === void 0) return false;
  if (typeof a === "object" && typeof b === "object") return isObjectDeepEqual(a, b);
  return false;
}
var ANGLE_UNITS = {
  grad: 360 / 400,
  turn: 360,
  rad: 360 / (Math.PI * 2)
};
function parseHue(value, unit = "deg") {
  return Number(value) * (ANGLE_UNITS[unit] || 1);
}
function clamp(value, [min, max]) {
  return Math.min(Math.max(value, min), max);
}
function round(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
function rgbaToHsva(color) {
  const { r, g, b, a } = color;
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  const hh = delta ? max === r ? (g - b) / delta : max === g ? 2 + (b - r) / delta : 4 + (r - g) / delta : 0;
  return {
    h: round(60 * (hh < 0 ? hh + 6 : hh), 2),
    s: round(max ? delta / max * 100 : 0, 2),
    v: round(max / 255 * 100, 2),
    a
  };
}
function rgbaToHex(color) {
  const { r, g, b, a } = color;
  const alphaHex = a < 1 ? round(a * 255, 0).toString(16).padStart(2, "0") : "";
  return "#" + r.toString(16).padStart(2, "0") + g.toString(16).padStart(2, "0") + b.toString(16).padStart(2, "0") + alphaHex;
}
var RGBA_STRING_REGEX = /rgba?\(?\s*(-?\d*\.?\d+)(%)?[,\s]+(-?\d*\.?\d+)(%)?[,\s]+(-?\d*\.?\d+)(%)?,?\s*[/\s]*(-?\d*\.?\d+)?(%)?\s*\)?/i;
function rgbaStringToHsva(rgbaString) {
  const match = RGBA_STRING_REGEX.exec(rgbaString);
  if (!match) return {
    h: 0,
    s: 0,
    v: 0,
    a: 1
  };
  return rgbaToHsva({
    r: Number(match[1]) / (match[2] ? 100 / 255 : 1),
    g: Number(match[3]) / (match[4] ? 100 / 255 : 1),
    b: Number(match[5]) / (match[6] ? 100 / 255 : 1),
    a: match[7] === void 0 ? 1 : Number(match[7]) / (match[8] ? 100 : 1)
  });
}
function rgbaToHexInt(rgba, alpha) {
  const { r, g, b, a } = rgba;
  const rgb = r << 16 | g << 8 | b;
  if (!alpha) return rgb;
  return rgb * 256 + Math.round(a * 255);
}
function hexIntToRgba(int, alpha) {
  if (!alpha) return {
    r: int >> 16 & 255,
    g: int >> 8 & 255,
    b: int & 255,
    a: 1
  };
  const a255 = int & 255;
  const rgb = (int - a255) / 256;
  return {
    r: rgb >> 16 & 255,
    g: rgb >> 8 & 255,
    b: rgb & 255,
    a: round(a255 / 255, 2)
  };
}
var HSV_STRING_REGEX = /hsva?\(?\s*(-?\d*\.?\d+)(deg|rad|grad|turn)?[,\s]+(-?\d*\.?\d+)%?[,\s]+(-?\d*\.?\d+)%?,?\s*[/\s]*(-?\d*\.?\d+)?(%)?\s*\)?/i;
function hsvaStringToHsva(hsvString) {
  const match = HSV_STRING_REGEX.exec(hsvString);
  if (!match) return {
    h: 0,
    s: 0,
    v: 0,
    a: 1
  };
  return roundHsva({
    h: parseHue(match[1], match[2]),
    s: Number(match[3]),
    v: Number(match[4]),
    a: match[5] === void 0 ? 1 : Number(match[5]) / (match[6] ? 100 : 1)
  });
}
function roundHsva(hsva) {
  return {
    h: round(hsva.h, 0),
    s: round(hsva.s, 0),
    v: round(hsva.v, 0),
    a: round(hsva.a, 2)
  };
}
function hsvaToHsla(hsva) {
  const { h, s, v, a } = hsva;
  const hh = (200 - s) * v / 100;
  return {
    h: round(h, 0),
    s: round(hh > 0 && hh < 200 ? s * v / 100 / (hh <= 100 ? hh : 200 - hh) * 100 : 0, 0),
    l: round(hh / 2, 0),
    a: round(a, 2)
  };
}
function hsvaToRgba(hsva) {
  let { h, s, v, a } = hsva;
  h = h / 360 * 6;
  s = s / 100;
  v = v / 100;
  const hh = Math.floor(h);
  const b = v * (1 - s);
  const c2 = v * (1 - (h - hh) * s);
  const d = v * (1 - (1 - h + hh) * s);
  const module = hh % 6;
  return {
    r: round([
      v,
      c2,
      b,
      b,
      d,
      v
    ][module] * 255, 0),
    g: round([
      d,
      v,
      v,
      c2,
      b,
      b
    ][module] * 255, 0),
    b: round([
      b,
      b,
      d,
      v,
      v,
      c2
    ][module] * 255, 0),
    a: round(a, 2)
  };
}
function hsvaToHex(hsva) {
  return rgbaToHex(hsvaToRgba(hsva));
}
function hsvaToHslString(hsva) {
  const { h, s, l } = hsvaToHsla(hsva);
  return `hsl(${h}, ${s}%, ${l}%)`;
}
function hsvaToHslaString(hsva) {
  const { h, s, l, a } = hsvaToHsla(hsva);
  return `hsla(${h}, ${s}%, ${l}%, ${a})`;
}
function getHsvaStyleVariables(hsva) {
  return {
    "--color-picker-hue": hsva.h,
    "--color-picker-saturation": hsva.s,
    "--color-picker-brightness": hsva.v,
    "--color-picker-alpha": hsva.a
  };
}
var CROMIA_NAMESPACE = "[Cromia]";
var CROMIA_ERROR_PREFIX = "[Cromia Error]";
function hexToRgba(hex) {
  const h = hex[0] === "#" ? hex.substring(1) : hex;
  if (h.length < 6) return {
    r: parseInt(h[0] + h[0], 16),
    g: parseInt(h[1] + h[1], 16),
    b: parseInt(h[2] + h[2], 16),
    a: h.length === 4 ? round(parseInt(h[3] + h[3], 16) / 255, 2) : 1
  };
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
    a: h.length === 8 ? round(parseInt(h.substring(6, 8), 16) / 255, 2) : 1
  };
}
function hexToHsva(hex) {
  return rgbaToHsva(hexToRgba(hex));
}
var HEX_MATCHER = /^#?([0-9A-F]{3,8})$/i;
function isHexValid(value, alpha) {
  const match = HEX_MATCHER.exec(value);
  const length = match ? match[1].length : 0;
  return length === 3 || length === 6 || !!alpha && length === 4 || !!alpha && length === 8;
}
function hslaToHsva(color) {
  let { h, s, l, a } = color;
  s *= (l < 50 ? l : 100 - l) / 100;
  return {
    h,
    s: s > 0 ? 2 * s / (l + s) * 100 : 0,
    v: l + s,
    a
  };
}
var HSL_STRING_REGEX = /hsla?\(?\s*(-?\d*\.?\d+)(deg|rad|grad|turn)?[,\s]+(-?\d*\.?\d+)%?[,\s]+(-?\d*\.?\d+)%?,?\s*[/\s]*(-?\d*\.?\d+)?(%)?\s*\)?/i;
function hslaStringToHsva(hslString) {
  const match = HSL_STRING_REGEX.exec(hslString);
  if (!match) return {
    h: 0,
    s: 0,
    v: 0,
    a: 1
  };
  return hslaToHsva({
    h: parseHue(match[1], match[2]),
    s: Number(match[3]),
    l: Number(match[4]),
    a: match[5] === void 0 ? 1 : Number(match[5]) / (match[6] ? 100 : 1)
  });
}
function parseAnyColor(input) {
  if (typeof input === "string") return string(input);
  return object(input);
}
var TRANSPARENT = {
  h: 0,
  s: 0,
  v: 0,
  a: 0
};
var DEFAULT = {
  h: 0,
  s: 0,
  v: 0,
  a: 1
};
function string(raw) {
  const value = raw.trim();
  const lower = value.toLowerCase();
  if (lower === "" || lower === "none") return DEFAULT;
  if (lower === "transparent") return TRANSPARENT;
  if (value.startsWith("#")) return hexToHsva(value);
  if (value.startsWith("rgb")) return rgbaStringToHsva(value);
  if (value.startsWith("hsl")) return hslaStringToHsva(value);
  if (value.startsWith("hsv") || value.startsWith("hsb")) return hsvaStringToHsva(value.replace(/^hsb/, "hsv"));
  throw new Error(`${CROMIA_ERROR_PREFIX}: Invalid color string: ${value}`);
}
function object(input) {
  if ("v" in input) return "a" in input ? input : {
    ...input,
    a: 1
  };
  if ("l" in input) return "a" in input ? hslaToHsva(input) : hslaToHsva({
    ...input,
    a: 1
  });
  if ("r" in input) return "a" in input ? rgbaToHsva(input) : rgbaToHsva({
    ...input,
    a: 1
  });
  throw new Error(`${CROMIA_ERROR_PREFIX}: Invalid color object: ${JSON.stringify(input)}`);
}
var ColorPickerRootContext = React2.createContext(null);
function useColorPickerRootContext() {
  const context = React2.useContext(ColorPickerRootContext);
  if (!context) throw new Error(`${CROMIA_NAMESPACE}: ColorPickerRootContext is missing. Cromia parts must be placed within <Cromia.Root>.`);
  return context;
}
function noop() {
}
var DEFAULT_HSVA = {
  h: 0,
  s: 0,
  v: 0,
  a: 1
};
function ColorPickerRoot(props) {
  const { color: colorProp, defaultColor, onColorChange = noop, onColorCommitted = noop, disabled = false, render, ref, children, ...rest } = props;
  const [hsva, setHsva] = React2.useState(() => {
    if (colorProp !== void 0) return parseAnyColor(colorProp);
    if (defaultColor !== void 0) return parseAnyColor(defaultColor);
    return DEFAULT_HSVA;
  });
  const hsvaRef = useValueAsRef(hsva);
  const currentHex = hsvaToHex(hsva);
  const isControlled = colorProp !== void 0;
  const prevColorProp = React2.useRef(colorProp);
  if (isControlled && !isAnyColorEqual(colorProp, prevColorProp.current)) {
    prevColorProp.current = colorProp;
    const parsed = parseAnyColor(colorProp);
    if (hsvaToHex(parsed) !== currentHex) {
      setHsva(parsed);
      hsvaRef.current = parsed;
    }
  }
  const [dragging, setDragging] = React2.useState(false);
  const handleUpdateHsva = (partial) => {
    const next = {
      ...hsvaRef.current,
      ...partial
    };
    setHsva(next);
    hsvaRef.current = next;
    onColorChange(hsvaToHex(next));
  };
  const handleColorCommitted = () => {
    onColorCommitted(hsvaToHex(hsvaRef.current));
  };
  const contextValue = {
    hsva,
    handleUpdateHsva,
    dragging,
    setDragging,
    disabled,
    handleColorCommitted
  };
  const element = useRender({
    render,
    defaultTagName: "div",
    ref,
    state: {
      disabled,
      dragging
    },
    stateAttributesMapping: rootStateAttributesMapping,
    props: mergeProps({
      "data-color-picker-root": "",
      children,
      style: getHsvaStyleVariables(hsva)
    }, rest)
  });
  return /* @__PURE__ */ jsx(ColorPickerRootContext.Provider, {
    value: contextValue,
    children: element
  });
}
var rootStateAttributesMapping = {
  disabled: bool("disabled"),
  dragging: bool("dragging")
};
var ARROW_UP = "ArrowUp";
var ARROW_DOWN = "ArrowDown";
var ARROW_LEFT = "ArrowLeft";
var ARROW_RIGHT = "ArrowRight";
var HOME = "Home";
var ENTER = "Enter";
var STEP = 0.05;
var LARGE_STEP = 0.1;
var ALLOWED_KEYS$1 = /* @__PURE__ */ new Set([
  ARROW_RIGHT,
  ARROW_LEFT,
  ARROW_DOWN,
  ARROW_UP,
  HOME,
  "End"
]);
function useColorPickerHandlers(options) {
  const { disabled, onMove, onKeyDown: onKey, onMoveStart, onMoveEnd, direction = "2d" } = options;
  const handlePointerDown = (event) => {
    if (disabled || event.button !== 0) return;
    const el = event.currentTarget;
    el.setPointerCapture(event.pointerId);
    el.focus();
    const rect = el.getBoundingClientRect();
    onMoveStart?.();
    onMove(getRelativePosition(rect, event));
  };
  const handlePointerMove = (event) => {
    if (disabled) return;
    const el = event.currentTarget;
    if (!el.hasPointerCapture(event.pointerId)) return;
    if (event.buttons === 0) {
      el.releasePointerCapture(event.pointerId);
      onMoveEnd?.();
      return;
    }
    onMove(getRelativePosition(el.getBoundingClientRect(), event));
  };
  const handlePointerUp = (event) => {
    if (disabled) return;
    const el = event.currentTarget;
    if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId);
    onMoveEnd?.();
  };
  const handleKeyDown = (event) => {
    if (disabled) return;
    if (!ALLOWED_KEYS$1.has(event.key)) return;
    const finalStep = event.shiftKey ? LARGE_STEP : STEP;
    let offset = null;
    if (direction === "2d") switch (event.key) {
      case ARROW_RIGHT:
        offset = {
          left: finalStep,
          top: 0
        };
        break;
      case ARROW_LEFT:
        offset = {
          left: -finalStep,
          top: 0
        };
        break;
      case ARROW_DOWN:
        offset = {
          left: 0,
          top: finalStep
        };
        break;
      case ARROW_UP:
        offset = {
          left: 0,
          top: -finalStep
        };
        break;
      case HOME:
        offset = {
          left: -1,
          top: -1
        };
        break;
      case "End":
        offset = {
          left: 1,
          top: 1
        };
        break;
    }
    else {
      const isVertical = direction === "vertical";
      const increase = (s) => isVertical ? {
        left: 0,
        top: -s
      } : {
        left: s,
        top: 0
      };
      const decrease = (s) => isVertical ? {
        left: 0,
        top: s
      } : {
        left: -s,
        top: 0
      };
      switch (event.key) {
        case ARROW_RIGHT:
        case ARROW_UP:
          offset = increase(finalStep);
          break;
        case ARROW_LEFT:
        case ARROW_DOWN:
          offset = decrease(finalStep);
          break;
        case HOME:
          offset = decrease(1);
          break;
        case "End":
          offset = increase(1);
          break;
      }
    }
    if (!offset) return;
    event.preventDefault();
    onKey(offset);
  };
  return {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onKeyDown: handleKeyDown
  };
}
function getRelativePosition(rect, event) {
  return {
    left: clamp((event.clientX - rect.left) / rect.width, [0, 1]),
    top: clamp((event.clientY - rect.top) / rect.height, [0, 1])
  };
}
function ColorPickerArea(props) {
  const { render, ref, children, ...rest } = props;
  const { hsva, handleUpdateHsva, dragging, setDragging, disabled, handleColorCommitted } = useColorPickerRootContext();
  const isDraggingRef = React2.useRef(false);
  const onMove = (interaction) => {
    handleUpdateHsva({
      s: interaction.left * 100,
      v: (1 - interaction.top) * 100
    });
  };
  const onKeyDown = (offset) => {
    handleUpdateHsva({
      s: clamp(hsva.s + offset.left * 100, [0, 100]),
      v: clamp(hsva.v - offset.top * 100, [0, 100])
    });
    handleColorCommitted();
  };
  const onMoveStart = () => {
    isDraggingRef.current = true;
    setDragging(true);
  };
  const onMoveEnd = () => {
    isDraggingRef.current = false;
    setDragging(false);
    handleColorCommitted();
  };
  const isBusy = dragging && !isDraggingRef.current;
  const handlers = useColorPickerHandlers({
    onMove,
    onKeyDown,
    onMoveStart,
    onMoveEnd,
    disabled: disabled || isBusy
  });
  return useRender({
    render,
    defaultTagName: "div",
    ref,
    state: {
      disabled,
      dragging
    },
    stateAttributesMapping: rootStateAttributesMapping,
    props: mergeProps({
      "data-color-picker-area": "",
      role: "group",
      tabIndex: disabled ? void 0 : 0,
      style: {
        touchAction: "none",
        position: "relative"
      },
      children,
      ...handlers
    }, rest)
  });
}
function ColorPickerAreaThumb(props) {
  const $ = c(15);
  const { render, ref, ...rest } = props;
  const { hsva, disabled, dragging } = useColorPickerRootContext();
  const left = hsva.s / 100;
  const top = 1 - hsva.v / 100;
  const thumbColor = hsvaToHslString(hsva);
  let t0;
  if ($[0] !== disabled || $[1] !== dragging || $[2] !== left || $[3] !== top) {
    t0 = {
      disabled,
      dragging,
      left,
      top
    };
    $[0] = disabled;
    $[1] = dragging;
    $[2] = left;
    $[3] = top;
    $[4] = t0;
  } else t0 = $[4];
  const state = t0;
  const style = {
    position: "absolute",
    left: `${left * 100}%`,
    top: `${top * 100}%`,
    backgroundColor: thumbColor,
    transform: "translateX(-50%) translateY(-50%)",
    "--color-picker-area-thumb-x": `${left * 100}%`,
    "--color-picker-area-thumb-y": `${top * 100}%`,
    "--color-picker-thumb-color": thumbColor
  };
  const t1 = "div";
  const t2 = areaThumbStateMapping;
  let t3;
  if ($[5] !== hsva.s) {
    t3 = Math.round(hsva.s);
    $[5] = hsva.s;
    $[6] = t3;
  } else t3 = $[6];
  let t4;
  if ($[7] !== hsva.v) {
    t4 = Math.round(hsva.v);
    $[7] = hsva.v;
    $[8] = t4;
  } else t4 = $[8];
  const t5 = mergeProps({
    "data-color-picker-area-thumb": "",
    role: "slider",
    tabIndex: disabled ? void 0 : 0,
    "aria-label": "Color",
    "aria-valuetext": `Saturation ${t3}%, Brightness ${t4}%`,
    style
  }, rest);
  let t6;
  if ($[9] !== ref || $[10] !== render || $[11] !== state || $[12] !== t2 || $[13] !== t5) {
    t6 = {
      render,
      defaultTagName: t1,
      ref,
      state,
      stateAttributesMapping: t2,
      props: t5
    };
    $[9] = ref;
    $[10] = render;
    $[11] = state;
    $[12] = t2;
    $[13] = t5;
    $[14] = t6;
  } else t6 = $[14];
  return useRender(t6);
}
var areaThumbStateMapping = {
  disabled: bool("disabled"),
  dragging: bool("dragging"),
  left: () => null,
  top: () => null
};
function ColorPickerAreaBackground(props) {
  const $ = c(4);
  const { render, ref, ...rest } = props;
  const { hsva } = useColorPickerRootContext();
  const hueColor = `hsl(${hsva.h}, 100%, 50%)`;
  const style = {
    position: "absolute",
    inset: 0,
    backgroundColor: hueColor,
    backgroundImage: "linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,transparent)",
    "--color-picker-hue-color": hueColor
  };
  const t0 = "div";
  const t1 = mergeProps({
    "data-color-picker-area-background": "",
    style
  }, rest);
  let t2;
  if ($[0] !== ref || $[1] !== render || $[2] !== t1) {
    t2 = {
      render,
      defaultTagName: t0,
      ref,
      props: t1
    };
    $[0] = ref;
    $[1] = render;
    $[2] = t1;
    $[3] = t2;
  } else t2 = $[3];
  return useRender(t2);
}
var HSVA_CHANNEL = {
  Hue: "hue",
  Saturation: "saturation",
  Brightness: "brightness",
  Alpha: "alpha"
};
var CHANNEL_LABELS = {
  [HSVA_CHANNEL.Hue]: "Hue",
  [HSVA_CHANNEL.Saturation]: "Saturation",
  [HSVA_CHANNEL.Brightness]: "Brightness",
  [HSVA_CHANNEL.Alpha]: "Alpha"
};
var HSVA_CHANNEL_CONFIG = {
  [HSVA_CHANNEL.Hue]: {
    key: "h",
    min: 0,
    max: 360,
    step: 1
  },
  [HSVA_CHANNEL.Saturation]: {
    key: "s",
    min: 0,
    max: 100,
    step: 1
  },
  [HSVA_CHANNEL.Brightness]: {
    key: "v",
    min: 0,
    max: 100,
    step: 1
  },
  [HSVA_CHANNEL.Alpha]: {
    key: "a",
    min: 0,
    max: 1,
    step: 0.01
  }
};
function readHsvaChannel(hsva, channel) {
  return hsva[HSVA_CHANNEL_CONFIG[channel].key];
}
var HUE_SPECTRUM = "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)";
var CHECKERBOARD_PATTERN = "repeating-conic-gradient(#e5e7eb 0% 25%, #fff 0% 50%)";
var CHANNEL_SLIDER_ORIENTATIONS = {
  horizontal: "horizontal",
  vertical: "vertical"
};
function getGradientDirection(orientation) {
  return orientation === CHANNEL_SLIDER_ORIENTATIONS.vertical ? "to top" : "to right";
}
function buildHueStyle(orientation) {
  const gradient = orientation === CHANNEL_SLIDER_ORIENTATIONS.vertical ? HUE_SPECTRUM.replace("to right", "to top") : HUE_SPECTRUM;
  return {
    backgroundImage: gradient,
    "--color-picker-slider-gradient": gradient,
    "--color-picker-slider-from": "#f00",
    "--color-picker-slider-to": "#f00"
  };
}
function buildAlphaStyle(hsva, orientation) {
  const direction = getGradientDirection(orientation);
  const from = hsvaToHslaString({
    ...hsva,
    a: 0
  });
  const to = hsvaToHslaString({
    ...hsva,
    a: 1
  });
  const gradient = `linear-gradient(${direction}, ${from}, ${to})`;
  return {
    backgroundImage: `${gradient}, ${CHECKERBOARD_PATTERN}`,
    backgroundSize: "100% 100%, 8px 8px",
    "--color-picker-slider-gradient": gradient,
    "--color-picker-slider-from": from,
    "--color-picker-slider-to": to
  };
}
function buildColorChannelStyle(hsva, channel, orientation) {
  const direction = getGradientDirection(orientation);
  const { key } = HSVA_CHANNEL_CONFIG[channel];
  const from = hsvaToHslString({
    ...hsva,
    [key]: 0
  });
  const to = hsvaToHslString({
    ...hsva,
    [key]: 100
  });
  const gradient = `linear-gradient(${direction}, ${from}, ${to})`;
  return {
    backgroundImage: gradient,
    "--color-picker-slider-gradient": gradient,
    "--color-picker-slider-from": from,
    "--color-picker-slider-to": to
  };
}
function getChannelSliderStyle(hsva, channel, orientation) {
  switch (channel) {
    case "hue":
      return buildHueStyle(orientation);
    case "alpha":
      return buildAlphaStyle(hsva, orientation);
    default:
      return buildColorChannelStyle(hsva, channel, orientation);
  }
}
var ColorPickerChannelSliderContext = React2.createContext(null);
function useColorPickerChannelSliderContext() {
  const context = React2.useContext(ColorPickerChannelSliderContext);
  if (!context) throw new Error(`${CROMIA_NAMESPACE}: ColorPickerChannelSliderContext is missing. Slider parts must be placed within <Cromia.ChannelSlider>.`);
  return context;
}
function ColorPickerChannelSlider(props) {
  const { channel, orientation = CHANNEL_SLIDER_ORIENTATIONS.horizontal, render, ref, children, ...rest } = props;
  const { hsva, handleUpdateHsva, dragging, setDragging, disabled, handleColorCommitted } = useColorPickerRootContext();
  const isDraggingRef = React2.useRef(false);
  const config = HSVA_CHANNEL_CONFIG[channel];
  const currentValue = readHsvaChannel(hsva, channel);
  const onMove = (interaction) => {
    const position = orientation === CHANNEL_SLIDER_ORIENTATIONS.vertical ? 1 - interaction.top : interaction.left;
    const value = config.min + position * (config.max - config.min);
    handleUpdateHsva({ [config.key]: clamp(value, [config.min, config.max]) });
  };
  const onKeyDown = (offset) => {
    const stepValue = (orientation === CHANNEL_SLIDER_ORIENTATIONS.vertical ? -offset.top : offset.left) * (config.max - config.min);
    handleUpdateHsva({ [config.key]: clamp(currentValue + stepValue, [config.min, config.max]) });
    handleColorCommitted();
  };
  const onMoveStart = () => {
    isDraggingRef.current = true;
    setDragging(true);
  };
  const onMoveEnd = () => {
    isDraggingRef.current = false;
    setDragging(false);
    handleColorCommitted();
  };
  const isBusy = dragging && !isDraggingRef.current;
  const handlers = useColorPickerHandlers({
    onMove,
    onKeyDown,
    onMoveStart,
    onMoveEnd,
    disabled: disabled || isBusy,
    direction: orientation
  });
  const sliderContextValue = {
    channel,
    orientation,
    value: currentValue,
    min: config.min,
    max: config.max,
    step: config.step
  };
  const element = useRender({
    render,
    defaultTagName: "div",
    ref,
    state: {
      disabled,
      dragging,
      channel,
      orientation
    },
    stateAttributesMapping: channelSliderStateMapping,
    props: mergeProps({
      "data-color-picker-channel-slider": "",
      style: {
        touchAction: "none",
        position: "relative"
      },
      children,
      ...handlers
    }, rest)
  });
  return /* @__PURE__ */ jsx(ColorPickerChannelSliderContext.Provider, {
    value: sliderContextValue,
    children: element
  });
}
var channelSliderStateMapping = {
  disabled: bool("disabled"),
  dragging: bool("dragging"),
  channel: (value) => ({ "data-channel": value }),
  orientation: (value) => ({ "data-orientation": value })
};
function ColorPickerChannelSliderTrack(props) {
  const $ = c(4);
  const { render, ref, ...rest } = props;
  const { hsva } = useColorPickerRootContext();
  const { channel, orientation } = useColorPickerChannelSliderContext();
  const style = getChannelSliderStyle(hsva, channel, orientation);
  const t0 = "div";
  const t1 = mergeProps({
    "data-color-picker-channel-slider-track": "",
    "data-channel": channel,
    style
  }, rest);
  let t2;
  if ($[0] !== ref || $[1] !== render || $[2] !== t1) {
    t2 = {
      render,
      defaultTagName: t0,
      ref,
      props: t1
    };
    $[0] = ref;
    $[1] = render;
    $[2] = t1;
    $[3] = t2;
  } else t2 = $[3];
  return useRender(t2);
}
function ColorPickerChannelSliderThumb(props) {
  const $ = c(12);
  const { render, ref, ...rest } = props;
  const { hsva, disabled, dragging } = useColorPickerRootContext();
  const { channel, orientation, value, min, max } = useColorPickerChannelSliderContext();
  const position = max > min ? (value - min) / (max - min) : 0;
  const thumbColor = channel === "alpha" ? hsvaToHslaString(hsva) : hsvaToHslString(hsva);
  const isHorizontal = orientation === CHANNEL_SLIDER_ORIENTATIONS.horizontal;
  const positionProp = isHorizontal ? "left" : "bottom";
  const crossAxis = isHorizontal ? "top" : "left";
  const positionValue = `${position * 100}%`;
  let t0;
  if ($[0] !== channel || $[1] !== disabled || $[2] !== dragging || $[3] !== orientation || $[4] !== position) {
    t0 = {
      disabled,
      dragging,
      channel,
      orientation,
      position
    };
    $[0] = channel;
    $[1] = disabled;
    $[2] = dragging;
    $[3] = orientation;
    $[4] = position;
    $[5] = t0;
  } else t0 = $[5];
  const state = t0;
  const style = {
    position: "absolute",
    backgroundColor: thumbColor,
    [positionProp]: positionValue,
    [crossAxis]: "50%",
    transform: "translateX(-50%) translateY(-50%)",
    "--color-picker-slider-thumb-position": positionValue,
    "--color-picker-thumb-color": thumbColor
  };
  const t1 = "div";
  const t2 = channelSliderThumbStateMapping;
  const t3 = mergeProps({
    "data-color-picker-channel-slider-thumb": "",
    role: "slider",
    tabIndex: disabled ? void 0 : 0,
    "aria-label": CHANNEL_LABELS[channel],
    "aria-valuenow": Math.round(value * 100) / 100,
    "aria-valuemin": min,
    "aria-valuemax": max,
    "aria-orientation": orientation,
    style
  }, rest);
  let t4;
  if ($[6] !== ref || $[7] !== render || $[8] !== state || $[9] !== t2 || $[10] !== t3) {
    t4 = {
      render,
      defaultTagName: t1,
      ref,
      state,
      stateAttributesMapping: t2,
      props: t3
    };
    $[6] = ref;
    $[7] = render;
    $[8] = state;
    $[9] = t2;
    $[10] = t3;
    $[11] = t4;
  } else t4 = $[11];
  return useRender(t4);
}
var channelSliderThumbStateMapping = {
  disabled: bool("disabled"),
  dragging: bool("dragging"),
  channel: (value) => ({ "data-channel": value }),
  orientation: (value) => ({ "data-orientation": value }),
  position: () => null
};
var LARGE_STEP_MULTIPLIER = 10;
var HEX_STEP = 1;
var HEX_LARGE_STEP = 16;
var ALLOWED_KEYS = /* @__PURE__ */ new Set([
  ARROW_UP,
  ARROW_DOWN,
  ENTER,
  HOME,
  "End"
]);
var CHANNEL_SUFFIX = {
  hue: "\xB0",
  saturation: "%",
  brightness: "%",
  alpha: "%"
};
function ColorPickerInput(props) {
  const { channel, prefixed = true, render, ref, ...rest } = props;
  const { hsva, handleUpdateHsva, handleColorCommitted } = useColorPickerRootContext();
  const displayValue = React2.useMemo(() => {
    if (channel === "hex" || channel === "hex-alpha") {
      const hex = hsvaToHex(channel === "hex" ? {
        ...hsva,
        a: 1
      } : hsva);
      return prefixed ? hex : hex.replace("#", "");
    }
    const val = readHsvaChannel(hsva, channel);
    const suffix = CHANNEL_SUFFIX[channel];
    if (channel === "alpha") return `${Math.round(val * 100)}${suffix}`;
    return `${Math.round(val)}${suffix}`;
  }, [hsva, channel]);
  const [editValue, setEditValue] = React2.useState(null);
  const [invalid, setInvalid] = React2.useState(false);
  const handleChange = (event) => {
    const raw = event.target.value;
    setEditValue(raw);
    const update2 = parseChannelInput(raw, channel);
    if (!update2) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    handleUpdateHsva(update2);
  };
  const handleBlur = () => {
    setEditValue(null);
    setInvalid(false);
    handleColorCommitted();
  };
  const handleFocus = (event_0) => {
    const input = event_0.target;
    queueMicrotask(input.select.bind(input));
  };
  const handleKeyDown = (event_1) => {
    if (!ALLOWED_KEYS.has(event_1.key)) return;
    if (event_1.key === "Enter") {
      event_1.currentTarget.blur();
      return;
    }
    const update_0 = getKeyUpdate(hsva, event_1.key, event_1.shiftKey, channel);
    if (!update_0) return;
    event_1.preventDefault();
    handleUpdateHsva(update_0);
    setEditValue(null);
    setInvalid(false);
    handleColorCommitted();
    const input_0 = event_1.currentTarget;
    queueMicrotask(input_0.select.bind(input_0));
  };
  return useRender({
    render,
    defaultTagName: "input",
    ref,
    props: mergeProps({
      "data-color-picker-input": "",
      "data-channel": channel,
      ...invalid ? { "data-invalid": "" } : {},
      "aria-invalid": invalid || void 0,
      value: editValue ?? displayValue,
      spellCheck: false,
      autoComplete: "off",
      onChange: handleChange,
      onBlur: handleBlur,
      onFocus: handleFocus,
      onKeyDown: handleKeyDown
    }, rest)
  });
}
function parseChannelInput(raw, channel) {
  const value = raw.trim();
  const isAlpha = channel === "hex-alpha" || channel === "alpha";
  if (channel === "hex" || channel === "hex-alpha") {
    const hex = value.startsWith("#") ? value : `#${value}`;
    if (!isHexValid(hex, isAlpha)) return null;
    const parsed = hexToHsva(hex);
    return isAlpha ? parsed : {
      h: parsed.h,
      s: parsed.s,
      v: parsed.v
    };
  }
  const cleaned = isAlpha ? value.replace(/%/g, "") : value.replace(/[°%]/g, "");
  const num = Number(cleaned.trim());
  if (Number.isNaN(num)) return null;
  if (isAlpha) {
    if (num < 0 || num > 100) return null;
    return { a: clamp(num / 100, [0, 1]) };
  }
  const config = HSVA_CHANNEL_CONFIG[channel];
  if (num < config.min || num > config.max) return null;
  return { [config.key]: clamp(num, [config.min, config.max]) };
}
function getKeyUpdate(hsva, key, shiftKey, channel) {
  if (channel === "hex" || channel === "hex-alpha") {
    const alpha = channel === "hex-alpha";
    const step2 = shiftKey ? HEX_LARGE_STEP : HEX_STEP;
    switch (key) {
      case ARROW_UP:
      case ARROW_DOWN: {
        const delta = key === "ArrowUp" ? step2 : -step2;
        const rgba = hsvaToRgba(hsva);
        const steppedRgba = hexIntToRgba(clamp(rgbaToHexInt(rgba) + delta, [0, 16777215]));
        steppedRgba.a = rgba.a;
        const result = rgbaToHsva(steppedRgba);
        return alpha ? result : {
          h: result.h,
          s: result.s,
          v: result.v
        };
      }
      case HOME: {
        const min = hexToHsva(alpha ? "#00000000" : "#000000");
        return alpha ? min : {
          h: min.h,
          s: min.s,
          v: min.v
        };
      }
      case "End": {
        const max = hexToHsva(alpha ? "#ffffffff" : "#ffffff");
        return alpha ? max : {
          h: max.h,
          s: max.s,
          v: max.v
        };
      }
      default:
        throw new Error(`${CROMIA_ERROR_PREFIX}: It should be impossible to reach this code path.`);
    }
  }
  const config = HSVA_CHANNEL_CONFIG[channel];
  const currentValue = readHsvaChannel(hsva, channel);
  const step = shiftKey ? config.step * LARGE_STEP_MULTIPLIER : config.step;
  switch (key) {
    case ARROW_UP:
      return { [config.key]: clamp(currentValue + step, [config.min, config.max]) };
    case ARROW_DOWN:
      return { [config.key]: clamp(currentValue - step, [config.min, config.max]) };
    case HOME:
      return { [config.key]: config.min };
    case "End":
      return { [config.key]: config.max };
    default:
      throw new Error(`${CROMIA_ERROR_PREFIX}: It should be impossible to reach this code path.`);
  }
}
var swatchStateMapping = {
  selected: bool("selected"),
  disabled: bool("disabled")
};
function ColorPickerSwatch(props) {
  const $ = c(22);
  let t0;
  let t1;
  let t2;
  let t3;
  let t4;
  let t5;
  let t6;
  if ($[0] !== props) {
    const { value, selected: t72, onSelect, disabled: t8, render, ref, ...rest } = props;
    const selected = t72 === void 0 ? false : t72;
    const disabled = t8 === void 0 ? false : t8;
    let t9;
    if ($[8] !== disabled || $[9] !== onSelect || $[10] !== value) {
      t9 = () => {
        if (disabled) return;
        onSelect?.(value);
      };
      $[8] = disabled;
      $[9] = onSelect;
      $[10] = value;
      $[11] = t9;
    } else t9 = $[11];
    const handleClick = t9;
    let t10;
    if ($[12] !== disabled || $[13] !== selected) {
      t10 = {
        selected,
        disabled
      };
      $[12] = disabled;
      $[13] = selected;
      $[14] = t10;
    } else t10 = $[14];
    const state = t10;
    t6 = useRender;
    t0 = render;
    t1 = "button";
    t2 = ref;
    t3 = state;
    t4 = swatchStateMapping;
    t5 = mergeProps({
      "data-color-picker-swatch": "",
      "data-swatch-color": value,
      type: "button",
      role: "radio",
      "aria-checked": selected,
      "aria-label": value,
      style: { backgroundColor: value },
      onClick: handleClick
    }, rest);
    $[0] = props;
    $[1] = t0;
    $[2] = t1;
    $[3] = t2;
    $[4] = t3;
    $[5] = t4;
    $[6] = t5;
    $[7] = t6;
  } else {
    t0 = $[1];
    t1 = $[2];
    t2 = $[3];
    t3 = $[4];
    t4 = $[5];
    t5 = $[6];
    t6 = $[7];
  }
  let t7;
  if ($[15] !== t0 || $[16] !== t1 || $[17] !== t2 || $[18] !== t3 || $[19] !== t4 || $[20] !== t5) {
    t7 = {
      render: t0,
      defaultTagName: t1,
      ref: t2,
      state: t3,
      stateAttributesMapping: t4,
      props: t5
    };
    $[15] = t0;
    $[16] = t1;
    $[17] = t2;
    $[18] = t3;
    $[19] = t4;
    $[20] = t5;
    $[21] = t7;
  } else t7 = $[21];
  return t6(t7);
}
function ColorPickerSwatchGroup(props) {
  const $ = c(11);
  let t0;
  let t1;
  let t2;
  let t3;
  let t4;
  if ($[0] !== props) {
    const { render, ref, children, ...rest } = props;
    t4 = useRender;
    t0 = render;
    t1 = "div";
    t2 = ref;
    t3 = mergeProps({
      "data-color-picker-swatch-group": "",
      role: "radiogroup",
      children
    }, rest);
    $[0] = props;
    $[1] = t0;
    $[2] = t1;
    $[3] = t2;
    $[4] = t3;
    $[5] = t4;
  } else {
    t0 = $[1];
    t1 = $[2];
    t2 = $[3];
    t3 = $[4];
    t4 = $[5];
  }
  let t5;
  if ($[6] !== t0 || $[7] !== t1 || $[8] !== t2 || $[9] !== t3) {
    t5 = {
      render: t0,
      defaultTagName: t1,
      ref: t2,
      props: t3
    };
    $[6] = t0;
    $[7] = t1;
    $[8] = t2;
    $[9] = t3;
    $[10] = t5;
  } else t5 = $[10];
  return t4(t5);
}
var color_picker_exports = /* @__PURE__ */ __exportAll({
  Area: () => ColorPickerArea,
  AreaBackground: () => ColorPickerAreaBackground,
  AreaThumb: () => ColorPickerAreaThumb,
  ChannelSlider: () => ColorPickerChannelSlider,
  ChannelSliderThumb: () => ColorPickerChannelSliderThumb,
  ChannelSliderTrack: () => ColorPickerChannelSliderTrack,
  Input: () => ColorPickerInput,
  Root: () => ColorPickerRoot,
  Swatch: () => ColorPickerSwatch,
  SwatchGroup: () => ColorPickerSwatchGroup
});

import { useState as useState2 } from "react";
var SWATCHES = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#1c1917",
  "#78716c"
];
var CHANNELS = ["hue", "saturation", "brightness", "alpha"];
var THUMB = "size-4 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.14)] bg-[var(--color-picker-thumb-color)]";
var SWATCH = "size-6 cursor-pointer rounded-md shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)] transition-opacity hover:opacity-80 data-[selected]:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08),0_0_0_2px_var(--background),0_0_0_3px_var(--foreground)]";
var AREA_BACKGROUND = "overflow-hidden rounded-lg bg-[linear-gradient(to_top,#000,transparent),linear-gradient(to_right,#fff,transparent)]";
function ColorPickerControls({
  color,
  onColorChange
}) {
  return /* @__PURE__ */ React2.createElement(React2.Fragment, null, /* @__PURE__ */ React2.createElement("div", { className: "mt-4 space-y-3" }, /* @__PURE__ */ React2.createElement(
    color_picker_exports.ChannelSlider,
    {
      channel: "hue",
      className: "relative h-3 w-full"
    },
    /* @__PURE__ */ React2.createElement(color_picker_exports.ChannelSliderTrack, { className: "h-full w-full rounded-full" }),
    /* @__PURE__ */ React2.createElement(color_picker_exports.ChannelSliderThumb, { className: THUMB })
  ), /* @__PURE__ */ React2.createElement(
    color_picker_exports.ChannelSlider,
    {
      channel: "alpha",
      className: "relative h-3 w-full"
    },
    /* @__PURE__ */ React2.createElement(color_picker_exports.ChannelSliderTrack, { className: "h-full w-full rounded-full" }),
    /* @__PURE__ */ React2.createElement(color_picker_exports.ChannelSliderThumb, { className: THUMB })
  )), /* @__PURE__ */ React2.createElement("div", { className: "mt-4 flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2" }, /* @__PURE__ */ React2.createElement(
    "div",
    {
      className: "size-5 shrink-0 rounded-md border border-black/10",
      style: { backgroundColor: color }
    }
  ), /* @__PURE__ */ React2.createElement(
    color_picker_exports.Input,
    {
      channel: "hex-alpha",
      className: "w-full bg-transparent font-mono text-sm uppercase text-foreground outline-none data-invalid:text-destructive"
    }
  )), /* @__PURE__ */ React2.createElement(color_picker_exports.SwatchGroup, { className: "mt-4 flex flex-wrap gap-2" }, SWATCHES.map((swatch) => /* @__PURE__ */ React2.createElement(
    color_picker_exports.Swatch,
    {
      key: swatch,
      value: swatch,
      selected: color === swatch,
      onSelect: onColorChange,
      className: SWATCH
    }
  ))), /* @__PURE__ */ React2.createElement("div", { className: "mt-4 grid grid-cols-4 gap-2" }, CHANNELS.map((channel) => /* @__PURE__ */ React2.createElement(
    "label",
    {
      key: channel,
      className: "flex items-center gap-1 rounded-md border border-border px-2 py-1.5"
    },
    /* @__PURE__ */ React2.createElement("span", { className: "text-[10px] font-medium uppercase text-muted-foreground" }, channel[0]),
    /* @__PURE__ */ React2.createElement(
      color_picker_exports.Input,
      {
        channel,
        className: "min-w-0 flex-1 bg-transparent text-right font-mono text-xs tabular-nums text-foreground outline-none"
      }
    )
  ))));
}
function settingsToHex(hue, saturation, brightness, alpha) {
  const h = ((hue % 360) + 360) % 360;
  const s = Math.max(0, Math.min(100, saturation)) / 100;
  const v = Math.max(0, Math.min(100, brightness)) / 100;
  const chroma = v * s;
  const segment = h / 60;
  const x = chroma * (1 - Math.abs(segment % 2 - 1));
  let red = 0;
  let green = 0;
  let blue = 0;
  if (segment < 1) [red, green, blue] = [chroma, x, 0];
  else if (segment < 2) [red, green, blue] = [x, chroma, 0];
  else if (segment < 3) [red, green, blue] = [0, chroma, x];
  else if (segment < 4) [red, green, blue] = [0, x, chroma];
  else if (segment < 5) [red, green, blue] = [x, 0, chroma];
  else [red, green, blue] = [chroma, 0, x];
  const match = v - chroma;
  const channel = (value) => Math.round((value + match) * 255).toString(16).padStart(2, "0");
  const opacity = Math.round(Math.max(0, Math.min(100, alpha)) / 100 * 255).toString(16).padStart(2, "0");
  return `#${channel(red)}${channel(green)}${channel(blue)}${opacity}`;
}
function CromiaColorPicker({
  hue = 217,
  saturation = 76,
  brightness = 96,
  alpha = 100
}) {
  const controlledColor = settingsToHex(hue, saturation, brightness, alpha);
  const [color, setColor] = React2.useState(controlledColor);
  React2.useEffect(() => {
    setColor(controlledColor);
  }, [controlledColor]);
  return /* @__PURE__ */ React2.createElement("div", { className: "w-full max-w-sm rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm" }, /* @__PURE__ */ React2.createElement(color_picker_exports.Root, { color, onColorChange: setColor }, /* @__PURE__ */ React2.createElement(color_picker_exports.Area, { className: "relative h-56 w-full cursor-crosshair" }, /* @__PURE__ */ React2.createElement(color_picker_exports.AreaBackground, { className: AREA_BACKGROUND }), /* @__PURE__ */ React2.createElement(color_picker_exports.AreaThumb, { className: THUMB })), /* @__PURE__ */ React2.createElement(ColorPickerControls, { color, onColorChange: setColor })));
}
type CromiaPart = React2.ComponentType<any>;
const ColorPicker = color_picker_exports as unknown as {
  Root: CromiaPart;
  Area: CromiaPart;
  AreaBackground: CromiaPart;
  AreaThumb: CromiaPart;
  ChannelSlider: CromiaPart;
  ChannelSliderTrack: CromiaPart;
  ChannelSliderThumb: CromiaPart;
  Input: CromiaPart;
  Swatch: CromiaPart;
  SwatchGroup: CromiaPart;
};
export {
  ColorPickerControls,
  CromiaColorPicker,
  ColorPicker
};
export default CromiaColorPicker;

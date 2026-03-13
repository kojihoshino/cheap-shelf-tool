"use client";

import React, { useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

const POST_W = 30;
const POST_D = 40;
const SCREW_NAME = "3.8×50";

const DEFAULTS = {
  width: 900,
  height: 1800,
  depth: 450,
  shelves: 4,
  middlePosts: 0,
  bottomHeight: 270,
  autoShelfHeights: true,
  manualHeights: [270, 620, 970, 1320],
  boardThickness: 12,
  woodLength: 1820,
  sheetWidth: 910,
  sheetHeight: 1820,
  kerf: 4,
  woodPrice: 398,
  sheetPrice: 1980,
};

type FormState = typeof DEFAULTS;
type InputState = ReturnType<typeof sanitize>;
type CalcResult = ReturnType<typeof calculate>;

type LinearPiece = { label: string; length: number };
type LinearPlacedPiece = LinearPiece & { start: number };
type LinearBin = { used: number; pieces: LinearPlacedPiece[] };

type BoardPiece = { label: string; width: number; height: number };
type BoardPlacedPiece = BoardPiece & { x: number; y: number; rotated: boolean };
type BoardRow = { y: number; height: number; usedWidth: number; groupKey: string; pieces: BoardPlacedPiece[] };
type BoardSheet = { width: number; height: number; rows: BoardRow[]; pieces: BoardPlacedPiece[] };

export default function ShelfGenerator() {
  const [form, setForm] = useState<FormState>(DEFAULTS);

  const input = useMemo(() => sanitize(form), [form]);
  const result = useMemo(() => calculate(input), [input]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateManualHeight(index: number, value: number) {
    const next = [...form.manualHeights];
    next[index] = value;
    setForm((prev) => ({ ...prev, manualHeights: next }));
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white text-zinc-900 p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="space-y-3">
          <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">かんたん棚ジェネレーター</p>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-sky-700">とにかく安い棚ジェネレーター</h1>
          <p className="text-zinc-600 leading-7 max-w-3xl">
            安く、簡単に、シンプルに棚を作るための設計ツール。サイズを入れると、買い物リスト、材料費、棚受け位置、3D、カット図が出ます。
          </p>
        </header>

        <div className="grid xl:grid-cols-[380px_1fr] gap-6">
          <section className="bg-white rounded-3xl border border-zinc-200 shadow-sm p-5 space-y-5 h-fit xl:sticky xl:top-6">
            <SectionTitle title="棚のサイズ" />
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="棚の横幅" value={form.width} onChange={(v) => updateField("width", v)} />
              <NumberField label="棚の高さ" value={form.height} onChange={(v) => updateField("height", v)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="棚の奥行き" value={form.depth} onChange={(v) => updateField("depth", v)} />
              <NumberField label="棚板の枚数" value={form.shelves} onChange={(v) => updateField("shelves", v)} min={1} step={1} />
            </div>
            <NumberField label="中央の支柱の数" value={form.middlePosts} onChange={(v) => updateField("middlePosts", v)} min={0} step={1} />

            <SectionTitle title="棚の高さ" />
            <NumberField label="一番下の棚の高さ" value={form.bottomHeight} onChange={(v) => updateField("bottomHeight", v)} />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.autoShelfHeights}
                onChange={(e) => updateField("autoShelfHeights", e.target.checked)}
              />
              上の棚は自動で均等配置
            </label>
            {!form.autoShelfHeights && (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: form.shelves }).map((_, i) => (
                  <NumberField
                    key={i}
                    label={`${i + 1}段目高さ`}
                    value={form.manualHeights[i] ?? 0}
                    onChange={(v) => updateManualHeight(i, v)}
                  />
                ))}
              </div>
            )}
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm leading-7 text-zinc-700">
              <p>・一般的なルンバの高さ目安：約10cm前後</p>
              <p>・一般的な掃除機ヘッドが入りやすい目安：約12〜15cm以上</p>
            </div>

            <SectionTitle title="買う材料のサイズ" />
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="木材の長さ" value={form.woodLength} onChange={(v) => updateField("woodLength", v)} />
              <NumberField label="棚板の厚み" value={form.boardThickness} onChange={(v) => updateField("boardThickness", v)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="合板の幅" value={form.sheetWidth} onChange={(v) => updateField("sheetWidth", v)} />
              <NumberField label="合板の長さ" value={form.sheetHeight} onChange={(v) => updateField("sheetHeight", v)} />
            </div>
            <NumberField label="ノコギリの切りしろ" value={form.kerf} onChange={(v) => updateField("kerf", v)} />
            <p className="text-xs text-zinc-500">ホームセンターカットのきりしろは一般的に約3mm〜4mmです</p>

            <SectionTitle title="値段" />
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="木材1本の値段" value={form.woodPrice} onChange={(v) => updateField("woodPrice", v)} />
              <NumberField label="合板1枚の値段" value={form.sheetPrice} onChange={(v) => updateField("sheetPrice", v)} />
            </div>
          </section>

          <section className="space-y-6">
            <div className="grid md:grid-cols-4 gap-4">
              <MetricCard label="支柱の列数" value={`${result.postLines}列`} sub={`${input.middlePosts}本追加`} />
              <MetricCard label="棚板の区切り数" value={`${result.spans}区間`} sub="横方向の分割数" />
              <MetricCard label="木材の必要本数" value={`${result.woodCount}本`} sub={`購入長さ ${formatMm(input.woodLength)}mm`} />
              <MetricCard label="合板の必要枚数" value={`${result.sheetCount}枚`} sub={`${formatMm(input.sheetWidth)}×${formatMm(input.sheetHeight)}`} />
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <MetricCard label="木材の金額" value={formatYen(result.woodCost)} sub={`${formatYen(input.woodPrice)} × ${result.woodCount}本`} />
              <MetricCard label="合板の金額" value={formatYen(result.sheetCost)} sub={`${formatYen(input.sheetPrice)} × ${result.sheetCount}枚`} />
              <MetricCard label="材料費合計" value={formatYen(result.totalCost)} sub="木材 + 合板" />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <InfoCard title="買い物リスト">
                <Row label="垂木 30×40" value={`${result.woodCount} 本`} />
                <Row label="合板" value={`${result.sheetCount} 枚`} />
                <Row label={`ビス（${SCREW_NAME} 推奨）`} value={`${result.screwCount} 本`} />
              </InfoCard>
              <InfoCard title="棚板サイズ">
                <Row label="一番上の棚" value={`${formatMm(result.topBoardWidth)} × ${formatMm(result.topBoardDepth)} mm`} />
                <Row label="それ以外の棚" value={`${formatMm(result.middleBoardWidth)} × ${formatMm(result.middleBoardDepth)} mm`} />
              </InfoCard>
            </div>

            <InfoCard title="棚受けを付ける高さ">
              {result.supportGuide.map((item, index) => (
                <Row
                  key={`${item.label}-${index}`}
                  label={item.label}
                  value={`柱の上から ${item.fromTopCm}cm / 柱の下から ${item.fromBottomCm}cm`}
                />
              ))}
            </InfoCard>

            {result.boardWarnings.length > 0 && (
              <InfoCard title="注意">
                {result.boardWarnings.map((msg, index) => (
                  <div key={index} className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-red-800 text-sm">
                    {msg}
                  </div>
                ))}
              </InfoCard>
            )}

            <InfoCard title="完成イメージ">
              <div className="rounded-3xl overflow-hidden border border-zinc-200 bg-white" style={{ height: 420 }}>
                <Canvas camera={{ position: [2.6, 1.9, 2.6], fov: 50 }} shadows>
                  <color attach="background" args={["#fafaf9"]} />
                  <ambientLight intensity={0.8} />
                  <directionalLight position={[5, 8, 5]} intensity={1.1} castShadow />
                  <directionalLight position={[-4, 3, -3]} intensity={0.35} />
                  <Shelf3D input={input} result={result} />
                  <gridHelper args={[4, 16, "#d4d4d4", "#ececec"]} position={[0, 0, 0]} />
                  <OrbitControls enablePan enableZoom enableRotate makeDefault />
                </Canvas>
              </div>
            </InfoCard>

            <InfoCard title="カット図">
              <CutDiagram input={input} result={result} />
            </InfoCard>
          </section>
        </div>
      </div>
    </div>
  );
}

function sanitize(form: FormState) {
  const manualHeights = Array.isArray(form.manualHeights) ? form.manualHeights.map((v) => Number(v) || 0) : [];
  return {
    width: clampNumber(form.width, 120, 5000, DEFAULTS.width),
    height: clampNumber(form.height, 200, 4000, DEFAULTS.height),
    depth: clampNumber(form.depth, 120, 2000, DEFAULTS.depth),
    shelves: clampInt(form.shelves, 1, 12, DEFAULTS.shelves),
    middlePosts: clampInt(form.middlePosts, 0, 12, DEFAULTS.middlePosts),
    bottomHeight: clampNumber(form.bottomHeight, 0, 3000, DEFAULTS.bottomHeight),
    autoShelfHeights: Boolean(form.autoShelfHeights),
    manualHeights,
    boardThickness: clampNumber(form.boardThickness, 2, 50, DEFAULTS.boardThickness),
    woodLength: clampNumber(form.woodLength, 100, 10000, DEFAULTS.woodLength),
    sheetWidth: clampNumber(form.sheetWidth, 100, 5000, DEFAULTS.sheetWidth),
    sheetHeight: clampNumber(form.sheetHeight, 100, 5000, DEFAULTS.sheetHeight),
    kerf: clampNumber(form.kerf, 0, 20, DEFAULTS.kerf),
    woodPrice: clampNumber(form.woodPrice, 0, 1000000, DEFAULTS.woodPrice),
    sheetPrice: clampNumber(form.sheetPrice, 0, 1000000, DEFAULTS.sheetPrice),
  };
}

function calculate(input: InputState) {
  const postLines = input.middlePosts + 2;
  const spans = Math.max(postLines - 1, 1);
  const clearWidth = Math.max(input.width - postLines * POST_W, 0);
  const clearSpan = clearWidth / spans;

  const topBoardWidth = input.width;
  const topBoardDepth = input.depth;
  const middleBoardWidth = clearSpan;
  const middleBoardDepth = input.depth;

  const verticalPosts = postLines * 2;
  const topSideRails = 2;
  const supportPerLevel = input.middlePosts * 2 + 2;
  const supportLevels = input.shelves + 1;
  const totalSupports = supportPerLevel * supportLevels;

  const woodPieces: LinearPiece[] = [
    ...Array.from({ length: verticalPosts }, () => ({ label: "支柱", length: input.height })),
    ...Array.from({ length: topSideRails }, () => ({ label: "上の横つなぎ", length: Math.max(input.depth - POST_D * 2, 0) })),
    ...Array.from({ length: totalSupports }, () => ({ label: "棚受け", length: input.depth })),
  ];

  const woodBins = packLinearCuts(woodPieces, input.woodLength, input.kerf);
  const totalWoodLength = woodPieces.reduce((sum, piece) => sum + piece.length, 0);
  const woodCount = Math.max(woodBins.length, 1);

  const boardPieces: BoardPiece[] = [
    { label: "一番上の棚", width: topBoardWidth, height: topBoardDepth },
    ...Array.from({ length: input.shelves * spans }, (_, i) => ({
      label: `棚板${i + 1}`,
      width: middleBoardWidth,
      height: middleBoardDepth,
    })),
  ];

  const boardPack = packBoardCuts(boardPieces, input.sheetWidth, input.sheetHeight, input.kerf);
  const sheetCount = Math.max(boardPack.sheets.length, 1);
  const totalBoardArea = boardPieces.reduce((sum, piece) => sum + piece.width * piece.height, 0);
  const screwCount = totalSupports * 4;
  const woodCost = woodCount * input.woodPrice;
  const sheetCost = sheetCount * input.sheetPrice;
  const totalCost = woodCost + sheetCost;

  const shelfBottoms = buildShelfBottomHeights(
    input.height,
    input.shelves,
    input.boardThickness,
    input.bottomHeight,
    input.autoShelfHeights,
    input.manualHeights
  );
  const supportGuide = buildSupportGuide(input.height, shelfBottoms, input.boardThickness);
  const boardWarnings = boardPack.unplaced.map(
    (piece) => `${piece.label} ${formatMm(piece.width)}×${formatMm(piece.height)}mm は、合板 ${formatMm(input.sheetWidth)}×${formatMm(input.sheetHeight)}mm に回転しても入りません。`
  );

  return {
    postLines,
    spans,
    verticalPosts,
    totalSupports,
    topBoardWidth,
    topBoardDepth,
    middleBoardWidth,
    middleBoardDepth,
    woodCount,
    sheetCount,
    screwCount,
    woodCost,
    sheetCost,
    totalCost,
    shelfBottoms,
    supportGuide,
    woodBins,
    totalWoodLength,
    boardSheets: boardPack.sheets,
    boardWarnings,
    totalBoardArea,
  };
}

function buildShelfBottomHeights(
  heightMm: number,
  shelves: number,
  boardThicknessMm: number,
  bottomHeightMm: number,
  auto: boolean,
  manual: number[]
) {
  const first = Math.min(bottomHeightMm, heightMm - boardThicknessMm);
  if (shelves <= 1) return [first];

  if (!auto) {
    const values = manual.slice(0, shelves).map((v, i) => (i === 0 ? first : Math.max(first, Math.min(v, heightMm - boardThicknessMm))));
    while (values.length < shelves) {
      values.push(first);
    }
    return values.sort((a, b) => a - b);
  }

  const last = Math.max(first, heightMm - boardThicknessMm * 2);
  return Array.from({ length: shelves }, (_, i) => first + ((last - first) * i) / (shelves - 1));
}

function buildSupportGuide(heightMm: number, shelfBottoms: number[], boardThicknessMm: number) {
  const supportCenters = [
    heightMm - POST_D / 2,
    ...shelfBottoms.map((bottomMm) => bottomMm + boardThicknessMm - (boardThicknessMm / 2 + POST_D / 2)),
  ];

  return supportCenters.map((center, index) => ({
    label: index === 0 ? "一番上の棚受け" : `${index}段目の下の棚受け`,
    fromTopCm: ((heightMm - center - POST_D / 2) / 10).toFixed(1),
    fromBottomCm: ((center - POST_D / 2) / 10).toFixed(1),
  }));
}

function packLinearCuts(pieces: LinearPiece[], stockLength: number, kerf: number): LinearBin[] {
  const sorted = [...pieces].sort((a, b) => b.length - a.length);
  const bins: LinearBin[] = [];

  for (const piece of sorted) {
    let placed = false;

    for (const bin of bins) {
      const needed = piece.length + (bin.pieces.length > 0 ? kerf : 0);
      if (bin.used + needed <= stockLength) {
        const start = bin.used + (bin.pieces.length > 0 ? kerf : 0);
        bin.pieces.push({ ...piece, start });
        bin.used += needed;
        placed = true;
        break;
      }
    }

    if (!placed) {
      bins.push({ used: piece.length, pieces: [{ ...piece, start: 0 }] });
    }
  }

  return bins;
}

function packBoardCuts(pieces: BoardPiece[], sheetWidth: number, sheetHeight: number, kerf: number) {
  const groups = new Map<string, BoardPiece[]>();
  const unplaced: BoardPiece[] = [];

  for (const piece of pieces) {
    const key = `${Math.max(piece.width, piece.height)}x${Math.min(piece.width, piece.height)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(piece);
  }

  const orderedGroups = [...groups.entries()]
    .map(([key, items]) => ({
      key,
      items: items.sort((a, b) => String(a.label).localeCompare(String(b.label), "ja")),
      maxSide: Math.max(items[0].width, items[0].height),
      minSide: Math.min(items[0].width, items[0].height),
    }))
    .sort((a, b) => b.maxSide - a.maxSide || b.minSide - a.minSide);

  const sheets: BoardSheet[] = [];

  for (const group of orderedGroups) {
    for (const piece of group.items) {
      let placed = false;

      for (const sheet of sheets) {
        if (placePieceOnSheet(sheet, piece, kerf, group.key)) {
          placed = true;
          break;
        }
      }

      if (!placed) {
        const sheet: BoardSheet = { width: sheetWidth, height: sheetHeight, rows: [], pieces: [] };
        if (placePieceOnSheet(sheet, piece, kerf, group.key)) {
          sheets.push(sheet);
        } else {
          unplaced.push(piece);
        }
      }
    }
  }

  return { sheets, unplaced };
}

function placePieceOnSheet(sheet: BoardSheet, piece: BoardPiece, kerf: number, groupKey: string) {
  const options = [
    { width: piece.width, height: piece.height, rotated: false },
    ...(piece.width !== piece.height ? [{ width: piece.height, height: piece.width, rotated: true }] : []),
  ];

  for (const option of options) {
    for (const row of sheet.rows) {
      const neededWidth = option.width + (row.pieces.length > 0 ? kerf : 0);
      if (row.groupKey !== groupKey) continue;
      if (row.height !== option.height) continue;
      if (row.usedWidth + neededWidth > sheet.width) continue;

      const x = row.usedWidth + (row.pieces.length > 0 ? kerf : 0);
      const placed: BoardPlacedPiece = {
        label: piece.label,
        width: option.width,
        height: option.height,
        rotated: option.rotated,
        x,
        y: row.y,
      };
      row.pieces.push(placed);
      row.usedWidth = x + option.width;
      sheet.pieces.push(placed);
      return true;
    }
  }

  const usedHeight = sheet.rows.reduce((max, row) => Math.max(max, row.y + row.height), 0);

  for (const option of options) {
    const newRowY = usedHeight + (sheet.rows.length > 0 ? kerf : 0);
    if (option.width > sheet.width) continue;
    if (newRowY + option.height > sheet.height) continue;

    const placed: BoardPlacedPiece = {
      label: piece.label,
      width: option.width,
      height: option.height,
      rotated: option.rotated,
      x: 0,
      y: newRowY,
    };

    sheet.rows.push({
      y: newRowY,
      height: option.height,
      usedWidth: option.width,
      pieces: [placed],
      groupKey,
    });
    sheet.pieces.push(placed);
    return true;
  }

  return false;
}

function Shelf3D({ input, result }: { input: InputState; result: CalcResult }) {
  const width = input.width / 1000;
  const height = input.height / 1000;
  const outerDepth = input.depth / 1000;
  const innerDepth = Math.max((input.depth - POST_D * 2) / 1000, 0.02);
  const postW = POST_W / 1000;
  const postD = POST_D / 1000;
  const boardT = Math.max(input.boardThickness / 1000, 0.002);
  const clearSpan = Math.max((Math.max(input.width - result.postLines * POST_W, 0) / result.spans) / 1000, 0);
  const xLeft = -width / 2;
  const postXs = Array.from({ length: result.postLines }, (_, i) => xLeft + postW / 2 + i * (postW + clearSpan));
  const zFront = outerDepth / 2 - postD / 2;
  const zBack = -outerDepth / 2 + postD / 2;
  const supports = buildSupportCenters(postXs, postW);
  const supportYs = [
    height - postD / 2,
    ...result.shelfBottoms.map((bottomMm) => ((bottomMm + input.boardThickness) / 1000) - (boardT / 2 + postD / 2)),
  ];
  const shelfYs = result.shelfBottoms.map((bottomMm) => bottomMm / 1000 + boardT / 2);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
        <planeGeometry args={[4, 4]} />
        <meshStandardMaterial color="#f5f5f4" />
      </mesh>

      {postXs.map((x, i) => (
        <group key={`posts-${i}`}>
          <mesh position={[x, height / 2, zFront]} castShadow receiveShadow>
            <boxGeometry args={[postW, height, postD]} />
            <meshStandardMaterial color="#b7793b" />
          </mesh>
          <mesh position={[x, height / 2, zBack]} castShadow receiveShadow>
            <boxGeometry args={[postW, height, postD]} />
            <meshStandardMaterial color="#9d6434" />
          </mesh>
        </group>
      ))}

      <mesh position={[-width / 2 + postW / 2, height - postW / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[postW, postW, innerDepth]} />
        <meshStandardMaterial color="#af733d" />
      </mesh>
      <mesh position={[width / 2 - postW / 2, height - postW / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[postW, postW, innerDepth]} />
        <meshStandardMaterial color="#996432" />
      </mesh>

      {supportYs.map((y, i) => (
        <group key={`support-${i}`}>
          {supports.map((s) => (
            <mesh key={`${i}-${s.key}`} position={[s.x, y, 0]} castShadow receiveShadow>
              <boxGeometry args={[postW, postD, outerDepth]} />
              <meshStandardMaterial color="#a56a36" />
            </mesh>
          ))}
        </group>
      ))}

      {shelfYs.map((y, i) => (
        <group key={`shelf-${i}`}>
          {Array.from({ length: result.spans }).map((_, spanIndex) => {
            const leftInside = postXs[spanIndex] + postW / 2;
            const rightInside = postXs[spanIndex + 1] - postW / 2;
            const boardWidth = Math.max(rightInside - leftInside, 0.02);
            const centerX = (leftInside + rightInside) / 2;
            return (
              <mesh key={`${i}-${spanIndex}`} position={[centerX, y, 0]} castShadow receiveShadow>
                <boxGeometry args={[boardWidth, boardT, outerDepth]} />
                <meshStandardMaterial color="#e0c684" />
              </mesh>
            );
          })}
        </group>
      ))}

      <mesh position={[0, height + boardT / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, boardT, outerDepth]} />
        <meshStandardMaterial color="#dec385" />
      </mesh>
    </group>
  );
}

function CutDiagram({ input, result }: { input: InputState; result: CalcResult }) {
  const width = 900;
  const woodX = 20;
  const woodY = 34;
  const woodW = 280;
  const woodH = 18;
  const woodScale = woodW / Math.max(input.woodLength, 1);
  const boardX = 360;
  const boardY = 34;
  const maxDrawW = 500;
  const maxDrawH = 460;
  const mmScale = Math.min(maxDrawW / Math.max(input.sheetWidth, 1), maxDrawH / Math.max(input.sheetHeight, 1));
  const sheetDrawW = input.sheetWidth * mmScale;
  const sheetDrawH = input.sheetHeight * mmScale;
  const sheetGap = 28;
  const shownSheets = Math.max(Math.min(result.boardSheets.length, 4), 1);
  const totalHeight = Math.max(560, boardY + (sheetDrawH + sheetGap) * shownSheets + 70);

  return (
    <svg viewBox={`0 0 ${width} ${totalHeight}`} className="w-full h-auto">
      <rect x="0" y="0" width={width} height={totalHeight} fill="#fff" />

      <text x={woodX} y={20} fontSize="14" fill="#111827">木材カット図</text>
      {result.woodBins.slice(0, 8).map((bin, i) => {
        const y = woodY + i * 30;
        return (
          <g key={i}>
            <rect x={woodX} y={y} width={woodW} height={woodH} fill="#f3f4f6" stroke="#9ca3af" />
            {bin.pieces.map((piece, j) => {
              const x = woodX + piece.start * woodScale;
              const w = Math.max(piece.length * woodScale, 2);
              return (
                <g key={j}>
                  <rect x={x} y={y} width={w} height={woodH} fill="#d97706" stroke="#92400e" />
                  <text x={x + 2} y={y + 12} fontSize="8" fill="#fff">{formatMm(piece.length)}</text>
                </g>
              );
            })}
            <text x={woodX + woodW + 8} y={y + 12} fontSize="10" fill="#374151">{i + 1}本目</text>
          </g>
        );
      })}
      <text x={woodX} y={woodY + 8 * 30 + 8} fontSize="11" fill="#374151">総使用長さ {formatMm(result.totalWoodLength)}mm / 購入 {result.woodCount}本</text>

      <text x={boardX} y={20} fontSize="14" fill="#111827">合板カット図</text>
      {result.boardSheets.slice(0, 4).map((sheet, i) => {
        const y = boardY + i * (sheetDrawH + sheetGap);
        return (
          <g key={i}>
            <rect x={boardX} y={y} width={sheetDrawW} height={sheetDrawH} fill="#f9fafb" stroke="#9ca3af" />

            {buildGridMarks(input.sheetWidth, 100).map((gx) => (
              <g key={`gx-${i}-${gx}`}>
                <line x1={boardX + gx * mmScale} y1={y} x2={boardX + gx * mmScale} y2={y + sheetDrawH} stroke="#e5e7eb" strokeWidth="1" />
                <text x={boardX + gx * mmScale + 2} y={y - 4} fontSize="8" fill="#6b7280">{gx}</text>
              </g>
            ))}
            {buildGridMarks(input.sheetHeight, 100).map((gy) => (
              <g key={`gy-${i}-${gy}`}>
                <line x1={boardX} y1={y + gy * mmScale} x2={boardX + sheetDrawW} y2={y + gy * mmScale} stroke="#e5e7eb" strokeWidth="1" />
                <text x={boardX - 22} y={y + gy * mmScale + 8} fontSize="8" fill="#6b7280">{gy}</text>
              </g>
            ))}

            {sheet.rows.map((row, rowIndex) => (
              <line
                key={`row-${i}-${rowIndex}`}
                x1={boardX}
                y1={y + row.y * mmScale}
                x2={boardX + sheetDrawW}
                y2={y + row.y * mmScale}
                stroke="#cbd5e1"
                strokeDasharray="3 2"
              />
            ))}

            {sheet.pieces.map((piece, j) => (
              <g key={j}>
                <rect
                  x={boardX + piece.x * mmScale}
                  y={y + piece.y * mmScale}
                  width={piece.width * mmScale}
                  height={piece.height * mmScale}
                  fill="#eab308"
                  stroke="#a16207"
                />
                <text x={boardX + piece.x * mmScale + 2} y={y + piece.y * mmScale + 10} fontSize="8" fill="#111827">{piece.label}</text>
                <text x={boardX + piece.x * mmScale + 2} y={y + piece.y * mmScale + 19} fontSize="7" fill="#374151">
                  {formatMm(piece.width)}×{formatMm(piece.height)}{piece.rotated ? "↺" : ""}
                </text>
              </g>
            ))}
            <text x={boardX} y={y + sheetDrawH + 14} fontSize="10" fill="#374151">{i + 1}枚目</text>
          </g>
        );
      })}
    </svg>
  );
}

function buildGridMarks(max: number, step: number) {
  const marks: number[] = [];
  for (let v = 0; v <= max; v += step) marks.push(v);
  if (marks[marks.length - 1] !== max) marks.push(max);
  return marks;
}

function buildSupportCenters(postXs: number[], postW: number) {
  const postLines = postXs.length;
  return postXs.flatMap((x, index) => {
    if (postLines === 1) return [{ x, key: `${index}-single` }];
    if (index === 0) return [{ x: x + postW, key: `${index}-inner` }];
    if (index === postLines - 1) return [{ x: x - postW, key: `${index}-inner` }];
    return [
      { x: x - postW, key: `${index}-left` },
      { x: x + postW, key: `${index}-right` },
    ];
  });
}

function SectionTitle({ title }: { title: string }) {
  return <h2 className="text-xs font-semibold text-sky-600 uppercase tracking-[0.18em]">{title}</h2>;
}

function NumberField({
  label,
  value,
  onChange,
  min,
  step,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  step?: number;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold tracking-wide text-zinc-700">{label}</label>
      <input
        type="number"
        min={min}
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(parseInputNumber(e.target.value, value))}
        className="w-full rounded-xl border border-zinc-300 px-4 py-3 bg-white outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
      />
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-3xl border border-sky-100 shadow-sm p-5">
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      <div className="space-y-3 text-sm">{children}</div>
    </div>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-white rounded-3xl border border-sky-100 shadow-sm p-5">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="text-2xl font-semibold mt-2">{value}</p>
      <p className="text-sm text-zinc-500 mt-1">{sub}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-sky-50 border border-sky-100 px-4 py-3">
      <p className="font-medium">{label}</p>
      <p className="text-right">{value}</p>
    </div>
  );
}

function parseInputNumber(rawValue: string, fallback: number) {
  if (rawValue === "" || rawValue == null) return fallback;
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampNumber(value: number, min: number, max: number, fallback: number) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function clampInt(value: number, min: number, max: number, fallback: number) {
  const num = Math.round(Number(value));
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function formatMm(value: number) {
  return Math.round(Number.isFinite(value) ? value : 0);
}

function formatYen(value: number) {
  return `¥${Math.round(Number.isFinite(value) ? value : 0).toLocaleString("ja-JP")}`;
}

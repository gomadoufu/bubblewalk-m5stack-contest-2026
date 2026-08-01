import type { BleDevice } from './ble/ble-client';
import { BubbleWalkGattRepository, type SyncStage } from './ble/bubblewalk-gatt-repository';
import { WebBluetoothClient } from './ble/web-bluetooth-client';
import { LocalBleDeviceStore } from './data/local-ble-device-store';
import { LocalOpinionStore } from './data/local-opinion-store';
import { listTopics } from './data/fixed-topic-repository';
import { mixColor } from './domain/color-mixer';
import type { Histogram } from './domain/histogram';
import { decideHistogramPrivacy } from './domain/privacy-policy';
import type { RgbColor } from './domain/rgb-color';
import { rgbToHex } from './domain/rgb-color';
import type { Topic } from './domain/topic';
import {
  triangleBytePointFromWeights,
  triangleColorForWeights,
  triangleWeightsForOpinion,
  type TriangleWeights,
} from './domain/triangle-picker';
import { createOpinion, type UserOpinion } from './domain/user-opinion';
import { APP_VERSION } from './app-version';

type Screen = 'create' | 'walk' | 'reveal';

const SYNC_COPY: Record<SyncStage, string> = {
  device_ready: 'Found your BubbleWalk',
  connect: 'Connecting…',
  connected: 'Connected',
  topic_written: 'Sending the question…',
  opinion_written: 'Sending your color…',
  settled: 'Lighting it up…',
  disconnected: 'Your color is ready',
};

export class ShowcaseApp {
  private readonly gatt = new BubbleWalkGattRepository(new WebBluetoothClient());
  private readonly deviceStore = new LocalBleDeviceStore();
  private readonly opinionStore = new LocalOpinionStore();
  private readonly topics = listTopics();
  private topic = this.topics[0];
  private opinion = this.loadOpinion(this.topic);
  private selectedDevice: BleDevice | null = null;
  private histogram: Histogram | null = null;
  private screen: Screen = 'create';
  private notice = '';
  private noticeKind: 'info' | 'error' = 'info';
  private busy = false;

  constructor(private readonly root: HTMLElement) {}

  async start(): Promise<void> {
    this.render();
    if (!this.gatt.capability().canRememberDevices) return;

    try {
      const paired = await this.gatt.listPairedDevices();
      const selectedId = this.deviceStore.selectedDeviceId();
      this.selectedDevice = paired.find((device) => device.id === selectedId) ?? null;
      this.render();
    } catch {
      // The device picker still works when remembered-device lookup is unavailable.
    }
  }

  render(): void {
    const ownColor = this.colorForOpinion(this.topic, this.opinion.opinionValue, this.opinion.triangleWeights);
    const capability = this.gatt.capability();

    this.root.innerHTML = `
      <div class="ambient ambient-one"></div>
      <div class="ambient ambient-two"></div>
      <header class="hero">
        <a class="brand" href="#top" aria-label="BubbleWalk home">
          <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
          <span>BubbleWalk</span>
        </a>
        <p class="contest-label">M5Stack Global Innovation Contest 2026</p>
        <h1>Wear your color.<br><span>Meet a spectrum.</span></h1>
        <p class="hero-copy">Choose your side of a question, light up a pocket-sized device, and watch nearby viewpoints appear as color.</p>
      </header>

      <main id="top" class="shell">
        ${this.renderScreen(ownColor)}
        ${!capability.available ? `<p class="browser-note">${escapeHtml(capability.message)}</p>` : ''}
      </main>

      <footer>
        <span>Device to device. No names. No fixed gateway.</span>
        <span>BubbleWalk V1 · Web App ${APP_VERSION}</span>
      </footer>
    `;

    this.bindEvents();
  }

  private renderScreen(ownColor: RgbColor): string {
    if (this.screen === 'walk') return this.renderWalk(ownColor);
    if (this.screen === 'reveal') return this.renderReveal(ownColor);
    return this.renderCreate(ownColor);
  }

  private renderCreate(ownColor: RgbColor): string {
    const topicButtons = this.topics
      .map(
        (topic, index) => `
          <button class="topic-card ${topic.topicId === this.topic.topicId ? 'is-active' : ''}" data-topic-index="${index}" type="button">
            <span>${escapeHtml(topic.shortTitle ?? `Question ${index + 1}`)}</span>
            <strong>${escapeHtml(topic.title)}</strong>
          </button>`,
      )
      .join('');

    return `
      <section class="showcase-card create-card">
        <div class="section-heading">
          <p class="eyebrow">Pick a question</p>
          <h2>What color are you today?</h2>
        </div>
        <div class="topic-grid">${topicButtons}</div>

        <div class="color-studio">
          <div class="color-preview">
            <div class="color-orbit" style="--opinion-color: ${rgbToHex(ownColor)}">
              <div class="color-orb"><span>You</span></div>
            </div>
            <p id="color-hex">${rgbToHex(ownColor).toUpperCase()}</p>
          </div>
          <div class="opinion-control">
            ${this.renderOpinionControl(ownColor)}
          </div>
        </div>

        <div class="send-panel">
          <div>
            <p class="eyebrow">Light up</p>
            <h3>Press G9, then send your color.</h3>
            <p>The button opens a short Bluetooth window on NanoH2.</p>
          </div>
          <button id="sync-button" class="primary-action" type="button" ${this.busy ? 'disabled' : ''}>
            ${this.busy ? 'Sending…' : 'Send to BubbleWalk'}
          </button>
        </div>
        ${this.selectedDevice ? '<button id="change-device" class="text-action" type="button">Choose another device</button>' : ''}
        ${this.renderNotice()}
      </section>
    `;
  }

  private renderOpinionControl(ownColor: RgbColor): string {
    if (this.topic.selectionMode === 'triangle' && this.topic.choices?.length === 3) {
      return `
        <p class="control-prompt">Choose one, or make a color in between.</p>
        <div class="choice-row">
          ${this.topic.choices
            .map((choice, index) => {
              const color = choice.rgb ?? this.colorForOpinion(this.topic, choice.value);
              const selected = this.opinion.triangleWeights?.[index] === 1;
              return `<button class="choice-chip ${selected ? 'is-active' : ''}" data-choice-index="${index}" type="button" style="--choice-color: ${rgbToHex(color)}"><i></i>${escapeHtml(choice.label)}</button>`;
            })
            .join('')}
        </div>
        <label class="blend-control">
          <span><b>${escapeHtml(this.topic.leftLabel)}</b><b>${escapeHtml(this.topic.rightLabel)}</b></span>
          <input id="opinion-slider" type="range" min="0" max="255" value="${this.opinion.opinionValue}" style="--slider-color: ${rgbToHex(ownColor)}" />
          <small>Slide to blend the colors</small>
        </label>
      `;
    }

    return `
      <p class="control-prompt">Move the glow to the place that feels like you.</p>
      <label class="spectrum-control">
        <span><b>${escapeHtml(this.topic.leftLabel)}</b><b>${escapeHtml(this.topic.rightLabel)}</b></span>
        <input id="opinion-slider" type="range" min="0" max="255" value="${this.opinion.opinionValue}" style="--slider-color: ${rgbToHex(ownColor)}" />
      </label>
    `;
  }

  private renderWalk(ownColor: RgbColor): string {
    return `
      <section class="showcase-card walk-card">
        <div class="walk-visual" style="--opinion-color: ${rgbToHex(ownColor)}">
          <span class="signal signal-one"></span><span class="signal signal-two"></span><span class="signal signal-three"></span>
          <div class="color-orb"><span>You</span></div>
        </div>
        <p class="eyebrow">Your color is walking</p>
        <h2>Bring BubbleWalk near other colors.</h2>
        <p>Each device exchanges a tiny anonymous color signal directly with the devices it meets. The NeoHEX rings come alive as encounters happen.</p>
        <div class="action-row">
          <button id="reveal-button" class="primary-action" type="button" ${this.busy ? 'disabled' : ''}>Reveal the colors I met</button>
          <button id="another-button" class="secondary-action" type="button">Set up another device</button>
        </div>
        ${this.renderNotice()}
      </section>
    `;
  }

  private renderReveal(ownColor: RgbColor): string {
    const privacy = decideHistogramPrivacy(this.topic, this.histogram);
    const matchingTopic = this.histogram?.topicIdHash === this.topic.topicIdHash && this.histogram.topicVersion === this.topic.topicVersion;
    let result: string;

    if (!matchingTopic) {
      result = `<div class="result-message"><span>↻</span><h3>This device is carrying another question.</h3><p>Send your current color to it first, then take another walk.</p></div>`;
    } else if (!privacy.canShowBins) {
      const remaining = Math.max(1, this.topic.minDisplaySampleCount - (this.histogram?.sampleCount ?? 0));
      result = `<div class="result-message"><span>✦</span><h3>Your spectrum is just beginning.</h3><p>Meet ${remaining} more ${remaining === 1 ? 'color' : 'colors'} to reveal the palette.</p></div>`;
    } else {
      result = `
        <div class="encounter-cloud" aria-label="Colors encountered">
          ${this.renderEncounterBubbles(this.histogram)}
          <div class="encounter-you" style="--opinion-color: ${rgbToHex(ownColor)}"><span>You</span></div>
        </div>
        <div class="result-message compact"><span>✦</span><h3>A spectrum found you.</h3><p>No names and no public poll—just the colors this device encountered.</p></div>
      `;
    }

    return `
      <section class="showcase-card reveal-card">
        <p class="eyebrow">Your encounter palette</p>
        <h2>Every walk looks different.</h2>
        ${result}
        <div class="action-row">
          <button id="refresh-button" class="primary-action" type="button" ${this.busy ? 'disabled' : ''}>Refresh palette</button>
          <button id="fresh-button" class="secondary-action" type="button" ${this.busy ? 'disabled' : ''}>Start a fresh walk</button>
          <button id="another-button" class="text-action" type="button">Set up another device</button>
        </div>
        ${this.renderNotice()}
      </section>
    `;
  }

  private renderEncounterBubbles(histogram: Histogram | null): string {
    if (!histogram) return '';
    const bubbles: string[] = [];
    const total = Math.max(1, histogram.sampleCount);
    const limit = 28;

    histogram.bins.forEach((count, binIndex) => {
      const visibleCount = Math.max(0, Math.round((count / total) * Math.min(total, limit)));
      const value = Math.round(((binIndex + 0.5) / histogram.binCount) * 255);
      const color = rgbToHex(this.colorForOpinion(this.topic, value));
      for (let index = 0; index < visibleCount && bubbles.length < limit; index += 1) {
        const size = 42 + ((binIndex * 17 + index * 11) % 36);
        const delay = ((binIndex + index) % 8) * 0.08;
        bubbles.push(`<i class="encounter-bubble" style="--bubble-color: ${color}; --bubble-size: ${size}px; --bubble-delay: ${delay}s" aria-hidden="true"></i>`);
      }
    });

    return bubbles.join('');
  }

  private renderNotice(): string {
    if (!this.notice) return '';
    return `<p class="notice ${this.noticeKind === 'error' ? 'is-error' : ''}" role="status">${escapeHtml(this.notice)}</p>`;
  }

  private bindEvents(): void {
    this.root.querySelectorAll<HTMLButtonElement>('[data-topic-index]').forEach((button) => {
      button.addEventListener('click', () => {
        const topic = this.topics[Number(button.dataset.topicIndex)];
        if (!topic) return;
        this.topic = topic;
        this.opinion = this.loadOpinion(topic);
        this.histogram = null;
        this.clearNotice();
        this.render();
      });
    });

    this.root.querySelectorAll<HTMLButtonElement>('[data-choice-index]').forEach((button) => {
      button.addEventListener('click', () => this.selectChoice(Number(button.dataset.choiceIndex)));
    });

    this.root.querySelector<HTMLInputElement>('#opinion-slider')?.addEventListener('input', (event) => {
      this.updateOpinion(Number((event.currentTarget as HTMLInputElement).value));
    });

    this.onClick('sync-button', () => this.sync());
    this.onClick('change-device', () => this.chooseAnotherDevice());
    this.onClick('another-button', () => this.chooseAnotherDevice());
    this.onClick('reveal-button', () => this.readPalette());
    this.onClick('refresh-button', () => this.readPalette());
    this.onClick('fresh-button', () => this.startFreshWalk());
  }

  private onClick(id: string, action: () => void | Promise<void>): void {
    this.root.querySelector<HTMLButtonElement>(`#${id}`)?.addEventListener('click', () => void action());
  }

  private selectChoice(index: number): void {
    const choice = this.topic.choices?.[index];
    if (!choice) return;
    const weights: TriangleWeights = [0, 0, 0];
    weights[index] = 1;
    const point = triangleBytePointFromWeights(weights);
    this.opinion = createOpinion(
      this.topic.topicId,
      this.topic.topicIdHash,
      this.topic.topicVersion,
      choice.value,
      new Date(),
      weights,
      point.x,
      point.y,
    );
    this.opinionStore.save(this.opinion);
    this.render();
  }

  private updateOpinion(value: number): void {
    const weights = this.topic.selectionMode === 'triangle' ? triangleWeightsForOpinion(this.topic, value) : undefined;
    const point = weights ? triangleBytePointFromWeights(weights) : undefined;
    this.opinion = createOpinion(
      this.topic.topicId,
      this.topic.topicIdHash,
      this.topic.topicVersion,
      value,
      new Date(),
      weights,
      point?.x,
      point?.y,
    );
    this.opinionStore.save(this.opinion);

    const color = rgbToHex(this.colorForOpinion(this.topic, value, weights));
    const orbit = this.root.querySelector<HTMLElement>('.color-orbit');
    const hex = this.root.querySelector<HTMLElement>('#color-hex');
    const slider = this.root.querySelector<HTMLElement>('#opinion-slider');
    orbit?.style.setProperty('--opinion-color', color);
    slider?.style.setProperty('--slider-color', color);
    if (hex) hex.textContent = color.toUpperCase();
    this.root.querySelectorAll('.choice-chip').forEach((chip) => chip.classList.remove('is-active'));
  }

  private async sync(): Promise<void> {
    if (this.busy) return;
    if (!this.gatt.capability().available) {
      this.setNotice(this.gatt.capability().message, 'error');
      return;
    }

    this.busy = true;
    this.setNotice('Keep G9 pressed briefly while BubbleWalk appears.', 'info', false);
    this.render();

    try {
      const result = await this.gatt.syncTopicAndOpinion(
        this.topic,
        this.opinion,
        this.selectedDevice ?? undefined,
        (stage) => this.updateVisibleNotice(SYNC_COPY[stage]),
      );
      this.selectedDevice = result.device;
      this.deviceStore.remember(result.device);
      this.deviceStore.saveSelectedDeviceId(result.device.id);
      this.screen = 'walk';
      this.setNotice('Your color is glowing on NeoHEX.', 'info', false);
    } catch (error) {
      console.error(error);
      if (error instanceof Error && error.message === 'selected_device_unavailable') {
        this.selectedDevice = null;
        this.deviceStore.saveSelectedDeviceId(null);
      }
      this.setNotice(friendlyBleError(error), 'error', false);
    } finally {
      this.busy = false;
      this.render();
    }
  }

  private async readPalette(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.setNotice('Reading the colors this device met…', 'info', false);
    this.render();

    try {
      const result = await this.gatt.readResult(this.selectedDevice ?? undefined);
      this.selectedDevice = result.device;
      this.histogram = result.histogram;
      this.deviceStore.remember(result.device);
      this.deviceStore.saveSelectedDeviceId(result.device.id);
      this.screen = 'reveal';
      this.clearNotice(false);
    } catch (error) {
      console.error(error);
      this.setNotice(friendlyBleError(error), 'error', false);
    } finally {
      this.busy = false;
      this.render();
    }
  }

  private async startFreshWalk(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.setNotice('Clearing the old palette…', 'info', false);
    this.render();

    try {
      const result = await this.gatt.resetHistogram(this.selectedDevice ?? undefined);
      this.selectedDevice = result.device;
      this.histogram = null;
      this.screen = 'walk';
      this.setNotice('Fresh walk ready. Go meet some colors!', 'info', false);
    } catch (error) {
      console.error(error);
      this.setNotice(friendlyBleError(error), 'error', false);
    } finally {
      this.busy = false;
      this.render();
    }
  }

  private chooseAnotherDevice(): void {
    this.selectedDevice = null;
    this.histogram = null;
    this.deviceStore.saveSelectedDeviceId(null);
    this.screen = 'create';
    this.setNotice('Pick a color, then choose the next BubbleWalk device.', 'info', false);
    this.render();
  }

  private loadOpinion(topic: Topic): UserOpinion {
    const saved = this.opinionStore.load(topic.topicId);
    if (saved?.topicIdHash === topic.topicIdHash && saved.topicVersion === topic.topicVersion) return saved;

    if (topic.selectionMode === 'triangle') {
      const weights: TriangleWeights = [0, 1, 0];
      const point = triangleBytePointFromWeights(weights);
      return createOpinion(topic.topicId, topic.topicIdHash, topic.topicVersion, 128, new Date(), weights, point.x, point.y);
    }
    return createOpinion(topic.topicId, topic.topicIdHash, topic.topicVersion, 128);
  }

  private colorForOpinion(topic: Topic, value: number, weights?: TriangleWeights): RgbColor {
    if (topic.selectionMode === 'triangle') {
      return triangleColorForWeights(topic, weights ?? triangleWeightsForOpinion(topic, value));
    }
    return mixColor(topic.leftRgb, topic.rightRgb, value);
  }

  private setNotice(message: string, kind: 'info' | 'error', rerender = true): void {
    this.notice = message;
    this.noticeKind = kind;
    if (rerender) this.render();
  }

  private clearNotice(rerender = true): void {
    this.notice = '';
    if (rerender) this.render();
  }

  private updateVisibleNotice(message: string): void {
    this.notice = message;
    const element = this.root.querySelector<HTMLElement>('.notice');
    if (element) element.textContent = message;
  }
}

function friendlyBleError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'NotFoundError') return 'No device selected. Press G9 and try again when you are ready.';
  if (error instanceof Error && error.message === 'selected_device_unavailable') return 'This device needs to be chosen again. Press G9, then retry.';
  if (error instanceof Error && error.message.includes('timeout')) return 'BubbleWalk did not answer in time. Press G9 and try once more.';
  return 'Could not reach BubbleWalk. Press G9, keep it close, and try again.';
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

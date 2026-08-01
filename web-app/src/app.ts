import type { BleDevice } from './ble/ble-client';
import { BubbleWalkGattRepository, type SyncStage } from './ble/bubblewalk-gatt-repository';
import { WebBluetoothClient } from './ble/web-bluetooth-client';
import { LocalBleDeviceStore } from './data/local-ble-device-store';
import { LocalOpinionStore } from './data/local-opinion-store';
import { listTopics } from './data/fixed-topic-repository';
import { mixColor } from './domain/color-mixer';
import type { EncounterSampleLog } from './domain/encounter-samples';
import { gravityPointsForSamples } from './domain/encounter-gravity';
import type { Histogram } from './domain/histogram';
import { decideHistogramPrivacy } from './domain/privacy-policy';
import type { RgbColor } from './domain/rgb-color';
import { rgbToHex } from './domain/rgb-color';
import type { Topic } from './domain/topic';
import {
  triangleBytePointFromWeights,
  triangleColorForWeights,
  triangleSelectionFromPoint,
  triangleWeightsForOpinion,
  wheelPointFromWeights,
  wheelSelectionFromPoint,
  type TriangleWeights,
} from './domain/triangle-picker';
import { createOpinion, type UserOpinion } from './domain/user-opinion';
import { APP_VERSION } from './app-version';
import {
  copyForLocale,
  isLocale,
  localeFromLanguageTags,
  SUPPORTED_LOCALES,
  type Locale,
} from './localization';

type Screen = 'create' | 'walk' | 'reveal';

const LOCALE_STORAGE_KEY = 'bubblewalk/locale/v1';

export class ShowcaseApp {
  private readonly gatt = new BubbleWalkGattRepository(new WebBluetoothClient());
  private readonly deviceStore = new LocalBleDeviceStore();
  private readonly opinionStore = new LocalOpinionStore();
  private readonly topics = listTopics();
  private topic = this.topics[0];
  private opinion = this.loadOpinion(this.topic);
  private selectedDevice: BleDevice | null = null;
  private histogram: Histogram | null = null;
  private encounterSamples: EncounterSampleLog | null = null;
  private screen: Screen = 'create';
  private notice = '';
  private noticeKind: 'info' | 'error' = 'info';
  private busy = false;
  private busyAction: 'sync' | 'read' | 'clear' | null = null;
  private locale = initialLocale();

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
    const copy = this.copy;
    const ownColor = this.colorForOpinion(this.topic, this.opinion.opinionValue, this.opinion.triangleWeights);
    const capability = this.gatt.capability();
    document.documentElement.lang = this.locale;
    document.title = copy.pageTitle;
    document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', copy.pageDescription);

    this.root.innerHTML = `
      <div class="ambient ambient-one"></div>
      <div class="ambient ambient-two"></div>
      <header class="hero">
        <div class="hero-topbar">
          <a class="brand" href="#top" aria-label="${escapeHtml(copy.homeAria)}">
            <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
            <span>BubbleWalk</span>
          </a>
          ${this.renderLanguageSwitcher()}
        </div>
        <p class="contest-label">M5Stack Global Innovation Contest 2026</p>
        <h1>${escapeHtml(copy.heroLineOne)}<br><span>${escapeHtml(copy.heroLineTwo)}</span></h1>
        <p class="hero-copy">${escapeHtml(copy.heroCopy)}</p>
      </header>

      <main id="top" class="shell">
        ${this.renderScreen(ownColor)}
        ${!capability.available ? `<p class="browser-note">${escapeHtml(this.capabilityMessage(capability.reason))}</p>` : ''}
      </main>

      <footer>
        <span>${escapeHtml(copy.footerPrivacy)}</span>
        <span>BubbleWalk · Web App ${APP_VERSION}</span>
      </footer>
    `;

    this.bindEvents();
  }

  private renderLanguageSwitcher(): string {
    const copy = this.copy;
    const options = SUPPORTED_LOCALES.map((locale) => {
      const label = copyForLocale(locale).languageName;
      return `<button type="button" data-locale="${locale}" lang="${locale}" aria-pressed="${locale === this.locale}">${escapeHtml(label)}</button>`;
    }).join('');
    return `
      <details class="language-switcher">
        <summary aria-label="${escapeHtml(copy.languageMenuLabel)}">
          <span aria-hidden="true">文</span><b>${escapeHtml(copy.languageName)}</b>
        </summary>
        <div class="language-options" role="group" aria-label="${escapeHtml(copy.languageMenuLabel)}">${options}</div>
      </details>
    `;
  }

  private renderScreen(ownColor: RgbColor): string {
    if (this.screen === 'walk') return this.renderWalk(ownColor);
    if (this.screen === 'reveal') return this.renderReveal(ownColor);
    return this.renderCreate(ownColor);
  }

  private renderCreate(ownColor: RgbColor): string {
    const copy = this.copy;
    const topicText = this.topicCopy(this.topic);

    return `
      <section class="showcase-card create-card">
        <div class="section-heading">
          <p class="eyebrow">${escapeHtml(copy.pickQuestion)}</p>
          <h2>${escapeHtml(topicText?.title ?? this.topic.title)}</h2>
        </div>

        <div class="color-studio">
          <div class="color-preview">
            <div class="color-orbit" style="--opinion-color: ${rgbToHex(ownColor)}">
              <div class="color-orb"><span>${escapeHtml(copy.you)}</span></div>
            </div>
            <p id="color-hex">${rgbToHex(ownColor).toUpperCase()}</p>
          </div>
          <div class="opinion-control">
            ${this.renderOpinionControl(ownColor)}
          </div>
        </div>

        <div class="home-device-actions">
          <div class="device-action-panel send-panel">
            <div>
              <p class="eyebrow">${escapeHtml(copy.lightUp)}</p>
              <h3>${escapeHtml(copy.sendTitle)}</h3>
              <p>${escapeHtml(copy.sendDescription)}</p>
            </div>
            <button id="sync-button" class="primary-action" type="button" ${this.busy ? 'disabled' : ''}>
              ${escapeHtml(this.busyAction === 'sync' ? copy.sending : copy.sendButton)}
            </button>
          </div>
          <div class="device-action-panel read-panel">
            <div>
              <p class="eyebrow">${escapeHtml(copy.readResultsEyebrow)}</p>
              <h3>${escapeHtml(copy.readResultsTitle)}</h3>
              <p>${escapeHtml(copy.readResultsDescription)}</p>
            </div>
            <button id="home-read-button" class="secondary-action" type="button" ${this.busy ? 'disabled' : ''}>
              ${escapeHtml(this.busyAction === 'read' ? copy.readingResults : copy.readResultsButton)}
            </button>
          </div>
        </div>
        ${this.selectedDevice ? `<button id="change-device" class="text-action" type="button">${escapeHtml(copy.changeDevice)}</button>` : ''}
        ${this.renderNotice()}
      </section>
    `;
  }

  private renderOpinionControl(ownColor: RgbColor): string {
    const copy = this.copy;
    const topicText = this.topicCopy(this.topic);
    if (this.topic.selectionMode === 'triangle' && this.topic.choices?.length === 3) {
      const weights = this.opinion.triangleWeights ?? triangleWeightsForOpinion(this.topic, this.opinion.opinionValue);
      const point = wheelPointFromWeights(weights);
      const centerColor = triangleColorForWeights(this.topic, [1 / 3, 1 / 3, 1 / 3]);
      return `
        <p class="control-prompt">${escapeHtml(copy.trianglePrompt)}</p>
        <div class="wheel-picker">
          ${this.topic.choices
            .map((choice, index) => {
              const color = choice.rgb ?? this.colorForOpinion(this.topic, choice.value);
              const selected = weights[index] > 0.995;
              const label = topicText?.choices[choice.id] ?? choice.label;
              return `<button class="wheel-choice wheel-choice-${index} ${selected ? 'is-active' : ''}" data-choice-index="${index}" type="button" style="--choice-color: ${rgbToHex(color)}" aria-pressed="${selected}"><i></i>${escapeHtml(label)}</button>`;
            })
            .join('')}
          <div id="color-wheel" class="color-wheel" tabindex="0"
            aria-label="${escapeHtml(copy.trianglePrompt)}"
            aria-valuetext="${escapeHtml(this.wheelValueText(weights))}"
            style="--wheel-a: ${rgbToHex(this.topic.choices[0].rgb ?? this.topic.leftRgb)}; --wheel-b: ${rgbToHex(this.topic.choices[1].rgb ?? centerColor)}; --wheel-c: ${rgbToHex(this.topic.choices[2].rgb ?? this.topic.rightRgb)}; --wheel-center: ${rgbToHex(centerColor)}; --wheel-x: ${point.xPercent.toFixed(2)}%; --wheel-y: ${point.yPercent.toFixed(2)}%;">
            <span class="wheel-cursor" aria-hidden="true"></span>
          </div>
        </div>
        <small class="wheel-hint">${escapeHtml(copy.wheelHint)}</small>
      `;
    }

    return `
      <p class="control-prompt">${escapeHtml(copy.spectrumPrompt)}</p>
      <label class="spectrum-control">
        <span><b>${escapeHtml(topicText?.leftLabel ?? this.topic.leftLabel)}</b><b>${escapeHtml(topicText?.rightLabel ?? this.topic.rightLabel)}</b></span>
        <input id="opinion-slider" type="range" min="0" max="255" value="${this.opinion.opinionValue}" style="--slider-color: ${rgbToHex(ownColor)}" />
      </label>
    `;
  }

  private renderWalk(ownColor: RgbColor): string {
    const copy = this.copy;
    return `
      <section class="showcase-card walk-card">
        <div class="walk-visual" style="--opinion-color: ${rgbToHex(ownColor)}">
          <span class="signal signal-one"></span><span class="signal signal-two"></span><span class="signal signal-three"></span>
          <div class="color-orb"><span>${escapeHtml(copy.you)}</span></div>
        </div>
        <p class="eyebrow">${escapeHtml(copy.walkingEyebrow)}</p>
        <h2>${escapeHtml(copy.walkingTitle)}</h2>
        <p>${escapeHtml(copy.walkingDescription)}</p>
        <div class="action-row">
          <button id="reveal-button" class="primary-action" type="button" ${this.busy ? 'disabled' : ''}>${escapeHtml(copy.revealButton)}</button>
          <button id="another-button" class="secondary-action" type="button">${escapeHtml(copy.anotherDevice)}</button>
        </div>
        ${this.renderNotice()}
      </section>
    `;
  }

  private renderReveal(ownColor: RgbColor): string {
    const copy = this.copy;
    const privacy = decideHistogramPrivacy(this.topic, this.histogram);
    const matchingTopic = this.histogram?.topicIdHash === this.topic.topicIdHash && this.histogram.topicVersion === this.topic.topicVersion;
    let result: string;

    if (!matchingTopic) {
      result = `<div class="result-message"><span>↻</span><h3>${escapeHtml(copy.wrongTopicTitle)}</h3><p>${escapeHtml(copy.wrongTopicBody)}</p></div>`;
    } else if (!privacy.canShowBins) {
      const remaining = Math.max(1, this.topic.minDisplaySampleCount - (this.histogram?.sampleCount ?? 0));
      result = `<div class="result-message"><span>✦</span><h3>${escapeHtml(copy.beginningTitle)}</h3><p>${escapeHtml(copy.remainingColors(remaining))}</p></div>`;
    } else {
      result = `
        <div id="encounter-gravity" class="encounter-gravity" aria-label="${escapeHtml(copy.encounteredAria)}" style="--opinion-color: ${rgbToHex(ownColor)}">
          <div class="gravity-atmosphere" aria-hidden="true"></div>
          <i class="gravity-orbit gravity-orbit-near" aria-hidden="true"></i>
          <i class="gravity-orbit gravity-orbit-middle" aria-hidden="true"></i>
          <i class="gravity-orbit gravity-orbit-far" aria-hidden="true"></i>
          ${this.renderEncounterBubbles(this.histogram, this.encounterSamples)}
          <button id="encounter-you" class="encounter-you" type="button" aria-label="${escapeHtml(copy.you)}"><span>${escapeHtml(copy.you)}</span></button>
          <div class="gravity-ripple-layer" aria-hidden="true"></div>
          <p class="gravity-hint">${escapeHtml(copy.gravityHint)}</p>
        </div>
        <div class="result-message compact"><span>✦</span><h3>${escapeHtml(copy.foundTitle)}</h3><p>${escapeHtml(copy.foundBody)}</p></div>
      `;
    }

    return `
      <section class="showcase-card reveal-card">
        <p class="eyebrow">${escapeHtml(copy.paletteEyebrow)}</p>
        <h2>${escapeHtml(copy.paletteTitle)}</h2>
        ${result}
        <div class="action-row">
          <button id="refresh-button" class="primary-action" type="button" ${this.busy ? 'disabled' : ''}>${escapeHtml(copy.refreshPalette)}</button>
          <button id="fresh-button" class="secondary-action" type="button" ${this.busy ? 'disabled' : ''}>${escapeHtml(copy.freshWalk)}</button>
          <button id="another-button" class="text-action" type="button">${escapeHtml(copy.anotherDevice)}</button>
        </div>
        ${this.renderNotice()}
      </section>
    `;
  }

  private renderEncounterBubbles(histogram: Histogram | null, encounterSamples: EncounterSampleLog | null): string {
    if (!histogram) return '';
    const bubbles: string[] = [];
    const total = Math.max(1, histogram.sampleCount);
    const limit = 28;

    if (
      this.topic.selectionMode === 'triangle' &&
      encounterSamples?.topicIdHash === this.topic.topicIdHash &&
      encounterSamples.topicVersion === this.topic.topicVersion &&
      encounterSamples.samples.length > 0
    ) {
      gravityPointsForSamples(encounterSamples.samples.slice(-limit)).forEach((point, index) => {
        const sample = point.sample;
        const weights = sample.triangleX === undefined || sample.triangleY === undefined
          ? triangleWeightsForOpinion(this.topic, sample.opinionValue)
          : triangleSelectionFromPoint(this.topic, sample.triangleX / 255, sample.triangleY / 255).weights;
        const color = rgbToHex(triangleColorForWeights(this.topic, weights));
        const delay = (index % 8) * 0.08;
        bubbles.push(`
          <button class="encounter-bubble" type="button"
            aria-label="${escapeHtml(this.copy.encounteredAria)} ${index + 1}"
            data-gravity-bubble data-color="${color}" data-strength="${point.strength.toFixed(3)}"
            style="--bubble-color: ${color}; --bubble-size: ${point.sizePx}px; --bubble-delay: ${delay}s; --bubble-x: ${point.xPercent.toFixed(2)}%; --bubble-y: ${point.yPercent.toFixed(2)}%; --bubble-strength: ${point.strength.toFixed(3)}; --bubble-opacity: ${point.opacity.toFixed(3)}">
            <i class="bubble-halo" aria-hidden="true"></i><i class="bubble-core" aria-hidden="true"></i>
          </button>`);
      });
      return bubbles.join('');
    }

    histogram.bins.forEach((count, binIndex) => {
      const visibleCount = Math.max(0, Math.round((count / total) * Math.min(total, limit)));
      const value = Math.round(((binIndex + 0.5) / histogram.binCount) * 255);
      const color = rgbToHex(this.colorForOpinion(this.topic, value));
      for (let index = 0; index < visibleCount && bubbles.length < limit; index += 1) {
        const bubbleIndex = bubbles.length;
        const angle = (bubbleIndex * 137.508 + binIndex * 19) * Math.PI / 180;
        const radius = 20 + ((binIndex * 7 + index * 5) % 20);
        const x = 50 + Math.cos(angle) * radius;
        const y = 50 + Math.sin(angle) * radius * 0.72;
        const size = 46 + ((binIndex * 17 + index * 11) % 30);
        const delay = ((binIndex + index) % 8) * 0.08;
        bubbles.push(`
          <button class="encounter-bubble" type="button"
            aria-label="${escapeHtml(this.copy.encounteredAria)} ${bubbleIndex + 1}"
            data-gravity-bubble data-color="${color}" data-strength="0.45"
            style="--bubble-color: ${color}; --bubble-size: ${size}px; --bubble-delay: ${delay}s; --bubble-x: ${x.toFixed(2)}%; --bubble-y: ${y.toFixed(2)}%; --bubble-strength: .45; --bubble-opacity: .9">
            <i class="bubble-halo" aria-hidden="true"></i><i class="bubble-core" aria-hidden="true"></i>
          </button>`);
      }
    });

    return bubbles.join('');
  }

  private renderNotice(): string {
    if (!this.notice) return '';
    return `<p class="notice ${this.noticeKind === 'error' ? 'is-error' : ''}" role="status">${escapeHtml(this.notice)}</p>`;
  }

  private bindEvents(): void {
    this.root.querySelectorAll<HTMLButtonElement>('[data-locale]').forEach((button) => {
      button.addEventListener('click', () => {
        const locale = button.dataset.locale;
        if (!isLocale(locale)) return;
        this.locale = locale;
        saveLocale(locale);
        this.render();
      });
    });

    this.root.querySelectorAll<HTMLButtonElement>('[data-topic-index]').forEach((button) => {
      button.addEventListener('click', () => {
        const topic = this.topics[Number(button.dataset.topicIndex)];
        if (!topic) return;
        this.topic = topic;
        this.opinion = this.loadOpinion(topic);
        this.histogram = null;
        this.encounterSamples = null;
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
    this.bindColorWheel();
    this.bindEncounterGravity();

    this.onClick('sync-button', () => this.sync());
    this.onClick('home-read-button', () => this.readPalette());
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

  private bindColorWheel(): void {
    const wheel = this.root.querySelector<HTMLElement>('#color-wheel');
    if (!wheel) return;
    let dragging = false;
    const updateFromPointer = (event: PointerEvent) => {
      const rect = wheel.getBoundingClientRect();
      this.updateWheelSelection((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
    };
    wheel.addEventListener('pointerdown', (event) => {
      dragging = true;
      wheel.setPointerCapture(event.pointerId);
      updateFromPointer(event);
    });
    wheel.addEventListener('pointermove', (event) => {
      if (dragging) updateFromPointer(event);
    });
    const stopDragging = () => { dragging = false; };
    wheel.addEventListener('pointerup', stopDragging);
    wheel.addEventListener('pointercancel', stopDragging);
    wheel.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      const weights = this.opinion.triangleWeights ?? triangleWeightsForOpinion(this.topic, this.opinion.opinionValue);
      const point = wheelPointFromWeights(weights);
      const step = event.shiftKey ? 0.08 : 0.025;
      const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
      const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
      this.updateWheelSelection(point.xPercent / 100 + dx, point.yPercent / 100 + dy);
    });
  }

  private bindEncounterGravity(): void {
    const field = this.root.querySelector<HTMLElement>('#encounter-gravity');
    const own = field?.querySelector<HTMLButtonElement>('#encounter-you');
    const rippleLayer = field?.querySelector<HTMLElement>('.gravity-ripple-layer');
    if (!field || !own || !rippleLayer) return;

    const bubbles = [...field.querySelectorAll<HTMLButtonElement>('[data-gravity-bubble]')];
    let dragging = false;
    let collidedBubble: HTMLButtonElement | null = null;

    const createRipple = (clientX: number, clientY: number, color: string) => {
      const rect = field.getBoundingClientRect();
      const ripple = document.createElement('i');
      ripple.className = 'gravity-ripple';
      ripple.style.left = `${clientX - rect.left}px`;
      ripple.style.top = `${clientY - rect.top}px`;
      ripple.style.setProperty('--ripple-color', color);
      rippleLayer.append(ripple);
      window.setTimeout(() => ripple.remove(), 1300);
    };

    const flashMix = (bubble: HTMLButtonElement) => {
      const color = bubble.dataset.color ?? '#ffffff';
      field.style.setProperty('--mix-color', color);
      field.classList.remove('is-mixing');
      void field.offsetWidth;
      field.classList.add('is-mixing');
      bubble.classList.add('is-touched');
      window.setTimeout(() => {
        field.classList.remove('is-mixing');
        bubble.classList.remove('is-touched');
      }, 850);
    };

    const updateGravity = (event: PointerEvent) => {
      const rect = field.getBoundingClientRect();
      const x = Math.max(9, Math.min(91, ((event.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(13, Math.min(87, ((event.clientY - rect.top) / rect.height) * 100));
      own.style.setProperty('--you-x', `${x}%`);
      own.style.setProperty('--you-y', `${y}%`);

      let nearest: HTMLButtonElement | null = null;
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (const bubble of bubbles) {
        const bubbleRect = bubble.getBoundingClientRect();
        const dx = event.clientX - (bubbleRect.left + bubbleRect.width / 2);
        const dy = event.clientY - (bubbleRect.top + bubbleRect.height / 2);
        const strength = Number(bubble.dataset.strength ?? 0.45);
        bubble.style.setProperty('--pull-x', `${dx * strength * 0.16}px`);
        bubble.style.setProperty('--pull-y', `${dy * strength * 0.16}px`);
        const distance = Math.hypot(dx, dy);
        if (distance < nearestDistance) {
          nearest = bubble;
          nearestDistance = distance;
        }
      }

      const collision = nearest && nearestDistance < (nearest.offsetWidth + own.offsetWidth) * 0.42
        ? nearest
        : null;
      if (collision && collision !== collidedBubble) {
        flashMix(collision);
        createRipple(event.clientX, event.clientY, collision.dataset.color ?? '#ffffff');
      }
      collidedBubble = collision;
    };

    own.addEventListener('pointerdown', (event) => {
      dragging = true;
      own.setPointerCapture(event.pointerId);
      field.classList.add('is-dragging');
      updateGravity(event);
    });
    own.addEventListener('pointermove', (event) => {
      if (dragging) updateGravity(event);
    });
    const release = (event: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      collidedBubble = null;
      field.classList.remove('is-dragging');
      own.style.removeProperty('--you-x');
      own.style.removeProperty('--you-y');
      bubbles.forEach((bubble) => {
        bubble.style.removeProperty('--pull-x');
        bubble.style.removeProperty('--pull-y');
      });
      createRipple(event.clientX, event.clientY, rgbToHex(this.colorForOpinion(this.topic, this.opinion.opinionValue, this.opinion.triangleWeights)));
    };
    own.addEventListener('pointerup', release);
    own.addEventListener('pointercancel', release);

    bubbles.forEach((bubble) => {
      bubble.addEventListener('pointerdown', (event) => {
        flashMix(bubble);
        createRipple(event.clientX, event.clientY, bubble.dataset.color ?? '#ffffff');
      });
    });
  }

  private updateWheelSelection(xRatio: number, yRatio: number): void {
    const selection = wheelSelectionFromPoint(this.topic, xRatio, yRatio);
    const bytePoint = triangleBytePointFromWeights(selection.weights);
    this.opinion = createOpinion(
      this.topic.topicId,
      this.topic.topicIdHash,
      this.topic.topicVersion,
      selection.opinionValue,
      new Date(),
      selection.weights,
      bytePoint.x,
      bytePoint.y,
    );
    this.opinionStore.save(this.opinion);

    const color = triangleColorForWeights(this.topic, selection.weights);
    this.updateColorPresentation(color);
    const wheel = this.root.querySelector<HTMLElement>('#color-wheel');
    wheel?.style.setProperty('--wheel-x', `${selection.point.xPercent.toFixed(2)}%`);
    wheel?.style.setProperty('--wheel-y', `${selection.point.yPercent.toFixed(2)}%`);
    wheel?.setAttribute('aria-valuetext', this.wheelValueText(selection.weights));
    this.root.querySelectorAll<HTMLButtonElement>('[data-choice-index]').forEach((button, index) => {
      const selected = selection.weights[index] > 0.995;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
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

    this.updateColorPresentation(this.colorForOpinion(this.topic, value, weights));
  }

  private updateColorPresentation(rgb: RgbColor): void {
    const color = rgbToHex(rgb);
    const orbit = this.root.querySelector<HTMLElement>('.color-orbit');
    const hex = this.root.querySelector<HTMLElement>('#color-hex');
    const slider = this.root.querySelector<HTMLElement>('#opinion-slider');
    orbit?.style.setProperty('--opinion-color', color);
    slider?.style.setProperty('--slider-color', color);
    if (hex) hex.textContent = color.toUpperCase();
  }

  private wheelValueText(weights: TriangleWeights): string {
    return this.topic.choices?.slice(0, 3).map((choice, index) => {
      const label = this.topicCopy(this.topic)?.choices[choice.id] ?? choice.label;
      return `${label} ${Math.round(weights[index] * 100)}%`;
    }).join(', ') ?? '';
  }

  private async sync(): Promise<void> {
    if (this.busy) return;
    if (!this.gatt.capability().available) {
      this.setNotice(this.capabilityMessage(this.gatt.capability().reason), 'error');
      return;
    }

    this.busy = true;
    this.busyAction = 'sync';
    this.setNotice(this.copy.notices.prepareSync, 'info', false);
    this.render();

    try {
      const result = await this.gatt.syncTopicAndOpinion(
        this.topic,
        this.opinion,
        // The home action must always show the browser picker so staff can
        // match the number on BubbleWalk when several devices are waiting.
        undefined,
        (stage) => this.updateVisibleNotice(this.syncMessage(stage)),
      );
      this.selectedDevice = result.device;
      this.deviceStore.remember(result.device);
      this.deviceStore.saveSelectedDeviceId(result.device.id);
      this.screen = 'walk';
      this.setNotice(this.copy.notices.syncDone, 'info', false);
    } catch (error) {
      console.error(error);
      if (error instanceof Error && error.message === 'selected_device_unavailable') {
        this.selectedDevice = null;
        this.deviceStore.saveSelectedDeviceId(null);
      }
      this.setNotice(this.friendlyBleError(error), 'error', false);
    } finally {
      this.busy = false;
      this.busyAction = null;
      this.render();
    }
  }

  private async readPalette(): Promise<void> {
    if (this.busy) return;
    if (!this.gatt.capability().available) {
      this.setNotice(this.capabilityMessage(this.gatt.capability().reason), 'error');
      return;
    }
    this.busy = true;
    this.busyAction = 'read';
    this.setNotice(this.copy.notices.reading, 'info', false);
    this.render();

    try {
      // Reading from the home screen is also an explicit device-selection
      // action; a remembered device may be a different BubbleWalk.
      const result = await this.gatt.readResult();
      this.selectedDevice = result.device;
      this.histogram = result.histogram;
      this.encounterSamples = result.encounterSamples;
      this.deviceStore.remember(result.device);
      this.deviceStore.saveSelectedDeviceId(result.device.id);
      this.screen = 'reveal';
      this.clearNotice(false);
    } catch (error) {
      console.error(error);
      if (error instanceof Error && error.message === 'selected_device_unavailable') {
        this.selectedDevice = null;
        this.deviceStore.saveSelectedDeviceId(null);
      }
      this.setNotice(this.friendlyBleError(error), 'error', false);
    } finally {
      this.busy = false;
      this.busyAction = null;
      this.render();
    }
  }

  private async startFreshWalk(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.busyAction = 'clear';
    this.setNotice(this.copy.notices.clearing, 'info', false);
    this.render();

    try {
      const result = await this.gatt.resetHistogram(this.selectedDevice ?? undefined);
      this.selectedDevice = result.device;
      this.histogram = null;
      this.encounterSamples = null;
      this.screen = 'walk';
      this.setNotice(this.copy.notices.freshReady, 'info', false);
    } catch (error) {
      console.error(error);
      this.setNotice(this.friendlyBleError(error), 'error', false);
    } finally {
      this.busy = false;
      this.busyAction = null;
      this.render();
    }
  }

  private chooseAnotherDevice(): void {
    this.selectedDevice = null;
    this.histogram = null;
    this.encounterSamples = null;
    this.deviceStore.saveSelectedDeviceId(null);
    this.screen = 'create';
    this.setNotice(this.copy.notices.chooseNext, 'info', false);
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

  private get copy() {
    return copyForLocale(this.locale);
  }

  private topicCopy(topic: Topic) {
    return this.copy.topics[topic.topicId];
  }

  private capabilityMessage(reason: string): string {
    if (reason === 'insecure_context') return this.copy.capability.insecure;
    if (reason === 'missing_api') return this.copy.capability.missing;
    return this.copy.capability.ready;
  }

  private syncMessage(stage: SyncStage): string {
    const sync = this.copy.sync;
    if (stage === 'device_ready') return sync.deviceReady;
    if (stage === 'connect') return sync.connect;
    if (stage === 'connected') return sync.connected;
    if (stage === 'topic_written') return sync.topicWritten;
    if (stage === 'opinion_written') return sync.opinionWritten;
    if (stage === 'settled') return sync.settled;
    return sync.disconnected;
  }

  private friendlyBleError(error: unknown): string {
    if (error instanceof DOMException && error.name === 'NotFoundError') return this.copy.errors.noDevice;
    if (error instanceof Error && error.message === 'selected_device_unavailable') return this.copy.errors.reselect;
    if (error instanceof Error && error.message.includes('timeout')) return this.copy.errors.timeout;
    return this.copy.errors.generic;
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

function initialLocale(): Locale {
  try {
    const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY) ?? undefined;
    if (isLocale(saved)) return saved;
  } catch {
    // Language detection still works when storage is unavailable.
  }
  return localeFromLanguageTags(navigator.languages.length > 0 ? navigator.languages : [navigator.language]);
}

function saveLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // The active language still applies for the current page.
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

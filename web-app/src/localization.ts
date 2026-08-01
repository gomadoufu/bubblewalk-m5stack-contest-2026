export const SUPPORTED_LOCALES = ['en', 'ja', 'zh-CN', 'ko'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

type TopicCopy = {
  shortTitle: string;
  title: string;
  choices: Record<string, string>;
  leftLabel: string;
  rightLabel: string;
};

export type UiCopy = {
  languageName: string;
  languageMenuLabel: string;
  pageTitle: string;
  pageDescription: string;
  homeAria: string;
  heroLineOne: string;
  heroLineTwo: string;
  heroCopy: string;
  pickQuestion: string;
  colorToday: string;
  questionFallback: (index: number) => string;
  you: string;
  trianglePrompt: string;
  blendHint: string;
  spectrumPrompt: string;
  lightUp: string;
  sendTitle: string;
  sendDescription: string;
  sending: string;
  sendButton: string;
  changeDevice: string;
  walkingEyebrow: string;
  walkingTitle: string;
  walkingDescription: string;
  revealButton: string;
  anotherDevice: string;
  paletteEyebrow: string;
  paletteTitle: string;
  wrongTopicTitle: string;
  wrongTopicBody: string;
  beginningTitle: string;
  remainingColors: (count: number) => string;
  encounteredAria: string;
  foundTitle: string;
  foundBody: string;
  refreshPalette: string;
  freshWalk: string;
  footerPrivacy: string;
  capability: {
    insecure: string;
    missing: string;
    ready: string;
  };
  sync: {
    deviceReady: string;
    connect: string;
    connected: string;
    topicWritten: string;
    opinionWritten: string;
    settled: string;
    disconnected: string;
  };
  notices: {
    prepareSync: string;
    syncDone: string;
    reading: string;
    clearing: string;
    freshReady: string;
    chooseNext: string;
  };
  errors: {
    noDevice: string;
    reselect: string;
    timeout: string;
    generic: string;
  };
  topics: Record<string, TopicCopy>;
};

const topic = (
  shortTitle: string,
  title: string,
  useful: string,
  playful: string,
  surprising: string,
): Record<string, TopicCopy> => ({
  'showcase-project-spark-001': {
    shortTitle,
    title,
    choices: { useful, playful, surprising },
    leftLabel: useful,
    rightLabel: surprising,
  },
});

const COPIES: Record<Locale, UiCopy> = {
  en: {
    languageName: 'English',
    languageMenuLabel: 'Choose language',
    pageTitle: 'BubbleWalk — Wear your color',
    pageDescription: 'Choose a color, carry it with BubbleWalk, and reveal the spectrum you meet.',
    homeAria: 'BubbleWalk home',
    heroLineOne: 'Wear your color.',
    heroLineTwo: 'Meet a spectrum.',
    heroCopy: 'Choose your side of a question, light up a pocket-sized device, and watch nearby viewpoints appear as color.',
    pickQuestion: 'Pick a question',
    colorToday: 'What color are you today?',
    questionFallback: (index) => `Question ${index}`,
    you: 'You',
    trianglePrompt: 'Choose one, or make a color in between.',
    blendHint: 'Slide to blend the colors',
    spectrumPrompt: 'Move the glow to the place that feels like you.',
    lightUp: 'Light up',
    sendTitle: 'Press G9, then send your color.',
    sendDescription: 'The button opens a short Bluetooth window on NanoH2.',
    sending: 'Sending…',
    sendButton: 'Send to BubbleWalk',
    changeDevice: 'Choose another device',
    walkingEyebrow: 'Your color is walking',
    walkingTitle: 'Bring BubbleWalk near other colors.',
    walkingDescription: 'Each device exchanges a tiny anonymous color signal directly with the devices it meets. The NeoHEX rings come alive as encounters happen.',
    revealButton: 'Reveal the colors I met',
    anotherDevice: 'Set up another device',
    paletteEyebrow: 'Your encounter palette',
    paletteTitle: 'Every walk looks different.',
    wrongTopicTitle: 'This device is carrying another question.',
    wrongTopicBody: 'Send your current color to it first, then take another walk.',
    beginningTitle: 'Your spectrum is just beginning.',
    remainingColors: (count) => `Meet ${count} more ${count === 1 ? 'color' : 'colors'} to reveal the palette.`,
    encounteredAria: 'Colors encountered',
    foundTitle: 'A spectrum found you.',
    foundBody: 'No names and no public poll—just the colors this device encountered.',
    refreshPalette: 'Refresh palette',
    freshWalk: 'Start a fresh walk',
    footerPrivacy: 'Device to device. No names. No fixed gateway.',
    capability: {
      insecure: 'Open BubbleWalk over HTTPS or localhost to connect a device.',
      missing: 'This browser cannot use Web Bluetooth. On iPhone, open this page in Bluefy.',
      ready: 'Web Bluetooth is ready.',
    },
    sync: {
      deviceReady: 'Found your BubbleWalk', connect: 'Connecting…', connected: 'Connected',
      topicWritten: 'Sending the question…', opinionWritten: 'Sending your color…',
      settled: 'Lighting it up…', disconnected: 'Your color is ready',
    },
    notices: {
      prepareSync: 'Keep G9 pressed briefly while BubbleWalk appears.',
      syncDone: 'Your color is glowing on NeoHEX.',
      reading: 'Reading the colors this device met…',
      clearing: 'Clearing the old palette…',
      freshReady: 'Fresh walk ready. Go meet some colors!',
      chooseNext: 'Pick a color, then choose the next BubbleWalk device.',
    },
    errors: {
      noDevice: 'No device selected. Press G9 and try again when you are ready.',
      reselect: 'This device needs to be chosen again. Press G9, then retry.',
      timeout: 'BubbleWalk did not answer in time. Press G9 and try once more.',
      generic: 'Could not reach BubbleWalk. Press G9, keep it close, and try again.',
    },
    topics: topic('Project spark', 'What gives a project its spark?', 'Useful', 'Playful', 'Surprising'),
  },
  ja: {
    languageName: '日本語', languageMenuLabel: '言語を選ぶ',
    pageTitle: 'BubbleWalk — 色をまとって歩こう',
    pageDescription: '自分の色をBubbleWalkにのせて、出会った色のスペクトラムを見てみよう。',
    homeAria: 'BubbleWalk ホーム', heroLineOne: '色をまとって。', heroLineTwo: 'スペクトラムに出会おう。',
    heroCopy: '質問への気持ちを色にして、手のひらサイズのデバイスを光らせよう。近くの人の考えも色になって現れます。',
    pickQuestion: '質問を選ぶ', colorToday: '今日のあなたは、どんな色？', questionFallback: (index) => `質問 ${index}`,
    you: 'あなた', trianglePrompt: 'ひとつ選ぶか、あいだの色を作ってみよう。', blendHint: 'スライドして色を混ぜる',
    spectrumPrompt: '今の気持ちに近い場所へ光を動かそう。', lightUp: 'デバイスを光らせる',
    sendTitle: 'G9を押してから、あなたの色を送ろう。', sendDescription: 'ボタンを押すと、NanoH2がしばらくBluetooth接続を受け付けます。',
    sending: '送信中…', sendButton: 'BubbleWalkに送る', changeDevice: '別のデバイスを選ぶ',
    walkingEyebrow: 'あなたの色と歩こう', walkingTitle: 'ほかの色にBubbleWalkを近づけよう。',
    walkingDescription: 'デバイス同士が、匿名の小さな色の信号を直接交換します。出会うたびにNeoHEXのリングが色づきます。',
    revealButton: '出会った色を見る', anotherDevice: '別のデバイスを設定する',
    paletteEyebrow: '出会いのカラーパレット', paletteTitle: '歩くたび、違う色に出会える。',
    wrongTopicTitle: 'このデバイスには別の質問が入っています。', wrongTopicBody: '先に今の色を送ってから、もう一度歩いてみよう。',
    beginningTitle: 'スペクトラムは、まだ始まったばかり。', remainingColors: (count) => `あと${count}色に出会うと、パレットを見られます。`,
    encounteredAria: '出会った色', foundTitle: 'スペクトラムが、あなたを見つけました。',
    foundBody: '名前も公開投票もありません。このデバイスが出会った色だけです。',
    refreshPalette: 'パレットを更新', freshWalk: '新しく歩き始める', footerPrivacy: 'デバイス同士で直接通信。名前なし。固定ゲートウェイなし。',
    capability: {
      insecure: 'デバイスに接続するには、BubbleWalkをHTTPSまたはlocalhostで開いてください。',
      missing: 'このブラウザはWeb Bluetoothに対応していません。iPhoneではBluefyで開いてください。',
      ready: 'Web Bluetoothを利用できます。',
    },
    sync: {
      deviceReady: 'BubbleWalkを見つけました', connect: '接続中…', connected: '接続しました',
      topicWritten: '質問を送信中…', opinionWritten: 'あなたの色を送信中…',
      settled: 'ライトを点灯中…', disconnected: 'あなたの色を準備できました',
    },
    notices: {
      prepareSync: 'BubbleWalkが表示されるまで、G9を短く押してください。', syncDone: 'NeoHEXがあなたの色に光っています。',
      reading: 'このデバイスが出会った色を読み取り中…', clearing: '前のパレットを消去中…',
      freshReady: '新しい散歩の準備ができました。色に出会いに行こう！', chooseNext: '色を作って、次のBubbleWalkデバイスを選ぼう。',
    },
    errors: {
      noDevice: 'デバイスが選ばれていません。準備ができたらG9を押して、もう一度試してください。',
      reselect: 'このデバイスは選び直す必要があります。G9を押して再試行してください。',
      timeout: 'BubbleWalkから時間内に応答がありませんでした。G9を押して、もう一度試してください。',
      generic: 'BubbleWalkに接続できませんでした。G9を押し、近くに置いて再試行してください。',
    },
    topics: topic('プロジェクトの魅力', 'プロジェクトを輝かせるものは？', '役立つ', '遊び心', '驚き'),
  },
  'zh-CN': {
    languageName: '中文', languageMenuLabel: '选择语言',
    pageTitle: 'BubbleWalk — 带上你的颜色', pageDescription: '把你的颜色带进BubbleWalk，看看一路遇见的光谱。',
    homeAria: 'BubbleWalk 首页', heroLineOne: '带上你的颜色。', heroLineTwo: '遇见一片光谱。',
    heroCopy: '选择你对一个问题的看法，点亮掌心大小的设备，让附近的观点化作颜色出现。',
    pickQuestion: '选择一个问题', colorToday: '今天的你是什么颜色？', questionFallback: (index) => `问题 ${index}`,
    you: '你', trianglePrompt: '选择一种，也可以调出中间的颜色。', blendHint: '滑动来混合颜色',
    spectrumPrompt: '把光移动到最符合你感受的位置。', lightUp: '点亮设备', sendTitle: '按下G9，然后发送你的颜色。',
    sendDescription: '按下按钮后，NanoH2会短暂开启蓝牙连接窗口。', sending: '发送中…', sendButton: '发送到BubbleWalk', changeDevice: '选择其他设备',
    walkingEyebrow: '让你的颜色一起散步', walkingTitle: '让BubbleWalk靠近其他颜色。',
    walkingDescription: '设备之间会直接交换微小的匿名颜色信号。每次相遇，NeoHEX的灯环都会亮起来。',
    revealButton: '查看我遇见的颜色', anotherDevice: '设置其他设备', paletteEyebrow: '你的相遇调色板', paletteTitle: '每次散步都有不同的色彩。',
    wrongTopicTitle: '这台设备正在使用另一个问题。', wrongTopicBody: '请先把当前颜色发送给它，再开始一次新的散步。',
    beginningTitle: '你的光谱才刚刚开始。', remainingColors: (count) => `再遇见${count}种颜色，就能看到调色板。`,
    encounteredAria: '遇见的颜色', foundTitle: '一片光谱找到了你。', foundBody: '没有姓名，也不是公开投票——这里只有这台设备遇见的颜色。',
    refreshPalette: '刷新调色板', freshWalk: '开始新的散步', footerPrivacy: '设备间直接通信。不记录姓名。无需固定网关。',
    capability: {
      insecure: '请通过HTTPS或localhost打开BubbleWalk，才能连接设备。',
      missing: '此浏览器不支持Web Bluetooth。请在iPhone上使用Bluefy打开此页面。', ready: 'Web Bluetooth已就绪。',
    },
    sync: {
      deviceReady: '已找到BubbleWalk', connect: '正在连接…', connected: '已连接', topicWritten: '正在发送问题…',
      opinionWritten: '正在发送你的颜色…', settled: '正在点亮…', disconnected: '你的颜色已准备好',
    },
    notices: {
      prepareSync: '短按G9，等待BubbleWalk出现在列表中。', syncDone: 'NeoHEX正亮起你的颜色。',
      reading: '正在读取这台设备遇见的颜色…', clearing: '正在清除之前的调色板…',
      freshReady: '新的散步已准备好。去遇见更多颜色吧！', chooseNext: '选好颜色，然后选择下一台BubbleWalk设备。',
    },
    errors: {
      noDevice: '尚未选择设备。准备好后按下G9，然后重试。', reselect: '需要重新选择此设备。按下G9，然后重试。',
      timeout: 'BubbleWalk未能及时响应。按下G9，再试一次。', generic: '无法连接BubbleWalk。按下G9，把设备靠近后重试。',
    },
    topics: topic('项目亮点', '什么让一个项目闪闪发光？', '实用', '有趣', '惊喜'),
  },
  ko: {
    languageName: '한국어', languageMenuLabel: '언어 선택',
    pageTitle: 'BubbleWalk — 나의 색을 지니고 걸어요', pageDescription: '나의 색을 BubbleWalk에 담고, 걸으며 만난 색의 스펙트럼을 확인해 보세요.',
    homeAria: 'BubbleWalk 홈', heroLineOne: '나의 색을 지니고.', heroLineTwo: '스펙트럼을 만나요.',
    heroCopy: '질문에 대한 생각을 색으로 만들고, 손바닥만 한 기기를 밝혀 보세요. 가까이 있는 다양한 관점이 색으로 나타납니다.',
    pickQuestion: '질문 선택', colorToday: '오늘의 나는 어떤 색인가요?', questionFallback: (index) => `질문 ${index}`,
    you: '나', trianglePrompt: '하나를 고르거나, 그 사이의 색을 만들어 보세요.', blendHint: '슬라이드해서 색 섞기',
    spectrumPrompt: '지금 내 마음과 가까운 곳으로 빛을 옮겨 보세요.', lightUp: '기기 밝히기', sendTitle: 'G9을 누른 다음, 나의 색을 보내세요.',
    sendDescription: '버튼을 누르면 NanoH2가 잠시 Bluetooth 연결을 기다립니다.', sending: '보내는 중…', sendButton: 'BubbleWalk로 보내기', changeDevice: '다른 기기 선택',
    walkingEyebrow: '나의 색과 함께 걷기', walkingTitle: 'BubbleWalk를 다른 색 가까이 가져가세요.',
    walkingDescription: '기기끼리 작은 익명 색상 신호를 직접 주고받습니다. 만남이 생길 때마다 NeoHEX 링이 색으로 빛납니다.',
    revealButton: '내가 만난 색 보기', anotherDevice: '다른 기기 설정', paletteEyebrow: '나의 만남 팔레트', paletteTitle: '걸을 때마다 다른 색을 만나요.',
    wrongTopicTitle: '이 기기에는 다른 질문이 담겨 있습니다.', wrongTopicBody: '먼저 지금의 색을 보낸 뒤, 다시 걸어 보세요.',
    beginningTitle: '나의 스펙트럼은 이제 시작이에요.', remainingColors: (count) => `${count}가지 색을 더 만나면 팔레트를 볼 수 있어요.`,
    encounteredAria: '만난 색', foundTitle: '스펙트럼이 나를 찾아왔어요.', foundBody: '이름도 공개 투표도 없이, 이 기기가 만난 색만 보여 줍니다.',
    refreshPalette: '팔레트 새로고침', freshWalk: '새로 걷기', footerPrivacy: '기기끼리 직접 통신. 이름 없음. 고정 게이트웨이 없음.',
    capability: {
      insecure: '기기에 연결하려면 HTTPS 또는 localhost에서 BubbleWalk를 열어 주세요.',
      missing: '이 브라우저는 Web Bluetooth를 지원하지 않습니다. iPhone에서는 Bluefy로 열어 주세요.', ready: 'Web Bluetooth를 사용할 수 있습니다.',
    },
    sync: {
      deviceReady: 'BubbleWalk를 찾았어요', connect: '연결 중…', connected: '연결됨', topicWritten: '질문을 보내는 중…',
      opinionWritten: '나의 색을 보내는 중…', settled: '불을 밝히는 중…', disconnected: '나의 색이 준비됐어요',
    },
    notices: {
      prepareSync: 'BubbleWalk가 나타날 때까지 G9을 짧게 눌러 주세요.', syncDone: 'NeoHEX가 나의 색으로 빛나고 있어요.',
      reading: '이 기기가 만난 색을 읽는 중…', clearing: '이전 팔레트를 지우는 중…',
      freshReady: '새로운 산책 준비 완료! 색을 만나러 가요.', chooseNext: '색을 고른 뒤 다음 BubbleWalk 기기를 선택하세요.',
    },
    errors: {
      noDevice: '기기가 선택되지 않았습니다. 준비되면 G9을 누르고 다시 시도하세요.',
      reselect: '이 기기를 다시 선택해야 합니다. G9을 누른 뒤 재시도하세요.',
      timeout: 'BubbleWalk가 제시간에 응답하지 않았습니다. G9을 누르고 다시 시도하세요.',
      generic: 'BubbleWalk에 연결할 수 없습니다. G9을 누르고 가까이 둔 뒤 다시 시도하세요.',
    },
    topics: topic('프로젝트의 매력', '프로젝트를 빛나게 하는 것은 무엇인가요?', '유용함', '즐거움', '놀라움'),
  },
};

export function isLocale(value: string | undefined): value is Locale {
  return SUPPORTED_LOCALES.includes(value as Locale);
}

export function localeFromLanguageTags(tags: readonly string[]): Locale {
  for (const tag of tags) {
    const normalized = tag.toLowerCase();
    if (normalized.startsWith('ja')) return 'ja';
    if (normalized.startsWith('zh')) return 'zh-CN';
    if (normalized.startsWith('ko')) return 'ko';
    if (normalized.startsWith('en')) return 'en';
  }
  return 'en';
}

export function copyForLocale(locale: Locale): UiCopy {
  return COPIES[locale];
}

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
  languageOptions: Record<Locale, string>;
  languageMenuLabel: string;
  pageTitle: string;
  pageDescription: string;
  homeAria: string;
  heroLineOne: string;
  heroLineTwo: string;
  heroCopy: string;
  pickQuestion: string;
  you: string;
  trianglePrompt: string;
  wheelHint: string;
  spectrumPrompt: string;
  lightUp: string;
  sendTitle: string;
  sendDescription: string;
  sending: string;
  sendButton: string;
  readResultsEyebrow: string;
  readResultsTitle: string;
  readResultsDescription: string;
  readResultsButton: string;
  readingResults: string;
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
  gravityHint: string;
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
  learn: string,
  create: string,
  connect: string,
): Record<string, TopicCopy> => ({
  'open-campus-activities-001': {
    shortTitle,
    title,
    choices: { learn, create, connect },
    leftLabel: learn,
    rightLabel: connect,
  },
});

const COPIES: Record<Locale, UiCopy> = {
  en: {
    languageName: 'English',
    languageOptions: { en: 'English', ja: 'Japanese', 'zh-CN': 'Simplified Chinese', ko: 'Korean' },
    languageMenuLabel: 'Choose language',
    pageTitle: 'BubbleWalk — Wear your color',
    pageDescription: 'Choose a color, carry it with BubbleWalk, and reveal the spectrum you meet.',
    homeAria: 'BubbleWalk home',
    heroLineOne: 'Wear your color.',
    heroLineTwo: 'Meet people with different ideas.',
    heroCopy: 'Turn what you want to try at university into a color, light up a pocket-sized device, and meet the colors around you.',
    pickQuestion: 'Today’s question',
    you: 'You',
    trianglePrompt: 'Where are you on this color wheel?',
    wheelHint: 'Tap or drag. The center blends all three.',
    spectrumPrompt: 'Move the glow to the place that feels like you.',
    lightUp: 'Light up',
    sendTitle: 'Press the button on the back of the device, then send your color.',
    sendDescription: 'The button opens a short Bluetooth window on BubbleWalk.',
    sending: 'Sending…',
    sendButton: 'Send to BubbleWalk',
    readResultsEyebrow: 'Reveal a device',
    readResultsTitle: 'Read the walk already inside.',
    readResultsDescription: 'Press the button on the back of the device, then choose the BubbleWalk whose encounter palette you want to see.',
    readResultsButton: 'Read results',
    readingResults: 'Reading…',
    changeDevice: 'Choose another device',
    walkingEyebrow: 'Your color is walking',
    walkingTitle: 'Take your color and meet other BubbleWalk devices.',
    walkingDescription: 'Each device exchanges a tiny anonymous color signal directly with the devices it meets. BubbleWalk comes alive as encounters happen.',
    revealButton: 'Reveal the colors I met',
    anotherDevice: 'Set up another device',
    paletteEyebrow: 'Your encounter palette',
    paletteTitle: 'Every walk looks different.',
    wrongTopicTitle: 'This device is carrying another question.',
    wrongTopicBody: 'Send your current color to it first, then take another walk.',
    beginningTitle: 'Your spectrum is just beginning.',
    remainingColors: (count) => `Meet ${count} more ${count === 1 ? 'color' : 'colors'} to reveal the palette.`,
    encounteredAria: 'Colors encountered',
    gravityHint: 'Drag your color. Tap another color to send ripples—the closer it floats, the stronger the encounter.',
    foundTitle: 'A spectrum found you.',
    foundBody: 'No names and no public poll—just the colors this device encountered.',
    refreshPalette: 'Refresh palette',
    freshWalk: 'Start a fresh walk',
    footerPrivacy: 'Device to device. No names. No fixed gateway.',
    capability: {
      insecure: 'Open BubbleWalk over HTTPS or localhost to connect a device.',
      missing: 'This browser cannot use Web Bluetooth. On iPhone or iPad, open this page in Bluefy.',
      ready: 'Web Bluetooth is ready.',
    },
    sync: {
      deviceReady: 'Found your BubbleWalk', connect: 'Connecting…', connected: 'Connected',
      topicWritten: 'Sending the question…', opinionWritten: 'Sending your color…',
      settled: 'Lighting it up…', disconnected: 'Your color is ready',
    },
    notices: {
      prepareSync: 'Briefly press the button on the back of the device, then choose the number shown on BubbleWalk.',
      syncDone: 'BubbleWalk is glowing with your color.',
      reading: 'Reading the colors this device met…',
      clearing: 'Clearing the old palette…',
      freshReady: 'Fresh walk ready. Go meet some colors!',
      chooseNext: 'Pick a color, then choose the next BubbleWalk device.',
    },
    errors: {
      noDevice: 'No device selected. Press the button on the back of the device and try again when you are ready.',
      reselect: 'This device needs to be chosen again. Press the button on the back of the device, then retry.',
      timeout: 'BubbleWalk did not answer in time. Press the button on the back of the device and try once more.',
      generic: 'Could not reach BubbleWalk. Press the button on the back of the device, keep it close, and try again.',
    },
    topics: topic(
      'University focus',
      'What would you like to focus on at university?',
      'Learn knowledge or skills',
      'Make games or art',
      'Connect with friends',
    ),
  },
  ja: {
    languageName: '日本語', languageMenuLabel: '言語を選ぶ',
    languageOptions: { en: '英語', ja: '日本語', 'zh-CN': '簡体字中国語', ko: '韓国語' },
    pageTitle: 'BubbleWalk — 色をまとって歩こう',
    pageDescription: '自分の色をBubbleWalkにのせて、出会った色のスペクトラムを見てみよう。',
    homeAria: 'BubbleWalk ホーム', heroLineOne: '色をまとって。', heroLineTwo: 'いろんな考えの人に出会おう。',
    heroCopy: '大学でやってみたいことを色にして、手のひらサイズのデバイスを光らせよう。近くの人の思いも色になって現れます。',
    pickQuestion: '今日の質問',
    you: 'あなた', trianglePrompt: 'カラーホイールの、どのあたり？', wheelHint: 'タップまたはドラッグ。中央では3色が混ざります。',
    spectrumPrompt: '今の気持ちに近い場所へ光を動かそう。', lightUp: 'デバイスを光らせる',
    sendTitle: 'デバイス裏面のボタンを押してから、あなたの色を送ろう。', sendDescription: 'ボタンを押すと、BubbleWalkがしばらくBluetooth接続を受け付けます。',
    sending: '送信中…', sendButton: 'BubbleWalkに送る',
    readResultsEyebrow: '結果を見る', readResultsTitle: 'このBubbleWalkの結果を読みだそう。',
    readResultsDescription: 'デバイス裏面のボタンを短く押して、出会いの結果を見たいBubbleWalkを選びます。',
    readResultsButton: '結果を読みだす', readingResults: '読み取り中…', changeDevice: '別のデバイスを選ぶ',
    walkingEyebrow: 'あなたの色と歩こう', walkingTitle: 'あなたの色を持って、他のBubbleWalkと出会おう。',
    walkingDescription: 'デバイス同士が、匿名の小さな色の信号を直接交換します。出会うたびにBubbleWalkが色づきます。',
    revealButton: '出会った色を見る', anotherDevice: '別のデバイスを設定する',
    paletteEyebrow: '出会いのカラーパレット', paletteTitle: '歩くたび、違う色に出会える。',
    wrongTopicTitle: 'このデバイスには別の質問が入っています。', wrongTopicBody: '先に今の色を送ってから、もう一度歩いてみよう。',
    beginningTitle: 'スペクトラムは、まだ始まったばかり。', remainingColors: (count) => `あと${count}色に出会うと、パレットを見られます。`,
    encounteredAria: '出会った色', gravityHint: 'あなたの色を動かそう。色をタップすると波紋が広がります。近い色ほど、強く出会った色です。',
    foundTitle: 'スペクトラムが、あなたを見つけました。',
    foundBody: '名前も公開投票もありません。このデバイスが出会った色だけです。',
    refreshPalette: 'パレットを更新', freshWalk: '新しく歩き始める', footerPrivacy: 'デバイス同士で直接通信。名前なし。固定ゲートウェイなし。',
    capability: {
      insecure: 'デバイスに接続するには、BubbleWalkをHTTPSまたはlocalhostで開いてください。',
      missing: 'このブラウザはWeb Bluetoothに対応していません。iPhoneまたはiPadではBluefyで開いてください。',
      ready: 'Web Bluetoothを利用できます。',
    },
    sync: {
      deviceReady: 'BubbleWalkを見つけました', connect: '接続中…', connected: '接続しました',
      topicWritten: '質問を送信中…', opinionWritten: 'あなたの色を送信中…',
      settled: 'ライトを点灯中…', disconnected: 'あなたの色を準備できました',
    },
    notices: {
      prepareSync: 'デバイス裏面のボタンを短く押し、BubbleWalkに表示された番号と同じ番号を選んでください。', syncDone: 'BubbleWalkがあなたの色に光っています。',
      reading: 'このデバイスが出会った色を読み取り中…', clearing: '前のパレットを消去中…',
      freshReady: '新しい散歩の準備ができました。色に出会いに行こう！', chooseNext: '色を作って、次のBubbleWalkデバイスを選ぼう。',
    },
    errors: {
      noDevice: 'デバイスが選ばれていません。準備ができたらデバイス裏面のボタンを押して、もう一度試してください。',
      reselect: 'このデバイスは選び直す必要があります。デバイス裏面のボタンを押して再試行してください。',
      timeout: 'BubbleWalkから時間内に応答がありませんでした。デバイス裏面のボタンを押して、もう一度試してください。',
      generic: 'BubbleWalkに接続できませんでした。デバイス裏面のボタンを押し、近くに置いて再試行してください。',
    },
    topics: topic(
      '大学で取りくみたいこと',
      '大学で、力をいれて取りくみたいことは？',
      '教養や技術を学ぶ',
      'ゲームや絵をつくる',
      '友達とつながる',
    ),
  },
  'zh-CN': {
    languageName: '中文', languageMenuLabel: '选择语言',
    languageOptions: { en: '英语', ja: '日语', 'zh-CN': '简体中文', ko: '韩语' },
    pageTitle: 'BubbleWalk — 带上你的颜色', pageDescription: '把你的颜色带进BubbleWalk，看看一路遇见的光谱。',
    homeAria: 'BubbleWalk 首页', heroLineOne: '带上你的颜色。', heroLineTwo: '去遇见想法各异的人吧。',
    heroCopy: '把你想在大学尝试的事情化作颜色，点亮掌心大小的设备，与周围的色彩相遇。',
    pickQuestion: '今天的问题',
    you: '你', trianglePrompt: '你在这个色轮的哪个位置？', wheelHint: '点击或拖动。中心会混合三种颜色。',
    spectrumPrompt: '把光移动到最符合你感受的位置。', lightUp: '点亮设备', sendTitle: '按下设备背面的按钮，然后发送你的颜色。',
    sendDescription: '按下按钮后，BubbleWalk会短暂开启蓝牙连接窗口。', sending: '发送中…', sendButton: '发送到BubbleWalk',
    readResultsEyebrow: '查看结果', readResultsTitle: '读取这台BubbleWalk中的结果。',
    readResultsDescription: '短按设备背面的按钮，然后选择要查看相遇调色板的BubbleWalk。',
    readResultsButton: '读取结果', readingResults: '正在读取…', changeDevice: '选择其他设备',
    walkingEyebrow: '让你的颜色一起散步', walkingTitle: '带上你的颜色，去遇见其他BubbleWalk吧。',
    walkingDescription: '设备之间会直接交换微小的匿名颜色信号。每次相遇，BubbleWalk都会亮起来。',
    revealButton: '查看我遇见的颜色', anotherDevice: '设置其他设备', paletteEyebrow: '你的相遇调色板', paletteTitle: '每次散步都有不同的色彩。',
    wrongTopicTitle: '这台设备正在使用另一个问题。', wrongTopicBody: '请先把当前颜色发送给它，再开始一次新的散步。',
    beginningTitle: '你的光谱才刚刚开始。', remainingColors: (count) => `再遇见${count}种颜色，就能看到调色板。`,
    encounteredAria: '遇见的颜色', gravityHint: '拖动你的颜色。点击其他颜色会泛起涟漪；越靠近中心，代表相遇时的信号越强。',
    foundTitle: '一片光谱找到了你。', foundBody: '没有姓名，也不是公开投票——这里只有这台设备遇见的颜色。',
    refreshPalette: '刷新调色板', freshWalk: '开始新的散步', footerPrivacy: '设备间直接通信。不记录姓名。无需固定网关。',
    capability: {
      insecure: '请通过HTTPS或localhost打开BubbleWalk，才能连接设备。',
      missing: '此浏览器不支持Web Bluetooth。请在iPhone或iPad上使用Bluefy打开此页面。', ready: 'Web Bluetooth已就绪。',
    },
    sync: {
      deviceReady: '已找到BubbleWalk', connect: '正在连接…', connected: '已连接', topicWritten: '正在发送问题…',
      opinionWritten: '正在发送你的颜色…', settled: '正在点亮…', disconnected: '你的颜色已准备好',
    },
    notices: {
      prepareSync: '短按设备背面的按钮，然后选择与BubbleWalk上显示的编号相同的设备。', syncDone: 'BubbleWalk正亮起你的颜色。',
      reading: '正在读取这台设备遇见的颜色…', clearing: '正在清除之前的调色板…',
      freshReady: '新的散步已准备好。去遇见更多颜色吧！', chooseNext: '选好颜色，然后选择下一台BubbleWalk设备。',
    },
    errors: {
      noDevice: '尚未选择设备。准备好后按下设备背面的按钮，然后重试。', reselect: '需要重新选择此设备。按下设备背面的按钮，然后重试。',
      timeout: 'BubbleWalk未能及时响应。按下设备背面的按钮，再试一次。', generic: '无法连接BubbleWalk。按下设备背面的按钮，把设备靠近后重试。',
    },
    topics: topic('大学里的重点', '在大学里，你最想专注于什么？', '学习知识或技术', '创作游戏或绘画', '与朋友建立联系'),
  },
  ko: {
    languageName: '한국어', languageMenuLabel: '언어 선택',
    languageOptions: { en: '영어', ja: '일본어', 'zh-CN': '중국어', ko: '한국어' },
    pageTitle: 'BubbleWalk — 나의 색을 지니고 걸어요', pageDescription: '나의 색을 BubbleWalk에 담고, 걸으며 만난 색의 스펙트럼을 확인해 보세요.',
    homeAria: 'BubbleWalk 홈', heroLineOne: '나의 색을 지니고.', heroLineTwo: '다양한 생각을 가진 사람들을 만나요.',
    heroCopy: '대학에서 해 보고 싶은 일을 색으로 만들고, 손바닥만 한 기기를 밝혀 보세요. 주변의 색과 만나게 됩니다.',
    pickQuestion: '오늘의 질문',
    you: '나', trianglePrompt: '컬러 휠에서 나는 어디쯤일까요?', wheelHint: '탭하거나 드래그하세요. 가운데에서는 세 색이 섞여요.',
    spectrumPrompt: '지금 내 마음과 가까운 곳으로 빛을 옮겨 보세요.', lightUp: '기기 밝히기', sendTitle: '기기 뒷면의 버튼을 누른 다음, 나의 색을 보내세요.',
    sendDescription: '버튼을 누르면 BubbleWalk가 잠시 Bluetooth 연결을 기다립니다.', sending: '보내는 중…', sendButton: 'BubbleWalk로 보내기',
    readResultsEyebrow: '결과 보기', readResultsTitle: '이 BubbleWalk의 결과를 읽어 보세요.',
    readResultsDescription: '기기 뒷면의 버튼을 짧게 누른 뒤, 만남 팔레트를 확인할 BubbleWalk를 선택하세요.',
    readResultsButton: '결과 읽기', readingResults: '읽는 중…', changeDevice: '다른 기기 선택',
    walkingEyebrow: '나의 색과 함께 걷기', walkingTitle: '나의 색을 가지고 다른 BubbleWalk를 만나 보세요.',
    walkingDescription: '기기끼리 작은 익명 색상 신호를 직접 주고받습니다. 만남이 생길 때마다 BubbleWalk가 색으로 빛납니다.',
    revealButton: '내가 만난 색 보기', anotherDevice: '다른 기기 설정', paletteEyebrow: '나의 만남 팔레트', paletteTitle: '걸을 때마다 다른 색을 만나요.',
    wrongTopicTitle: '이 기기에는 다른 질문이 담겨 있습니다.', wrongTopicBody: '먼저 지금의 색을 보낸 뒤, 다시 걸어 보세요.',
    beginningTitle: '나의 스펙트럼은 이제 시작이에요.', remainingColors: (count) => `${count}가지 색을 더 만나면 팔레트를 볼 수 있어요.`,
    encounteredAria: '만난 색', gravityHint: '나의 색을 움직여 보세요. 다른 색을 누르면 물결이 퍼져요. 중심에 가까울수록 더 강하게 만난 색이에요.',
    foundTitle: '스펙트럼이 나를 찾아왔어요.', foundBody: '이름도 공개 투표도 없이, 이 기기가 만난 색만 보여 줍니다.',
    refreshPalette: '팔레트 새로고침', freshWalk: '새로 걷기', footerPrivacy: '기기끼리 직접 통신. 이름 없음. 고정 게이트웨이 없음.',
    capability: {
      insecure: '기기에 연결하려면 HTTPS 또는 localhost에서 BubbleWalk를 열어 주세요.',
      missing: '이 브라우저는 Web Bluetooth를 지원하지 않습니다. iPhone 또는 iPad에서는 Bluefy로 열어 주세요.', ready: 'Web Bluetooth를 사용할 수 있습니다.',
    },
    sync: {
      deviceReady: 'BubbleWalk를 찾았어요', connect: '연결 중…', connected: '연결됨', topicWritten: '질문을 보내는 중…',
      opinionWritten: '나의 색을 보내는 중…', settled: '불을 밝히는 중…', disconnected: '나의 색이 준비됐어요',
    },
    notices: {
      prepareSync: '기기 뒷면의 버튼을 짧게 누른 뒤 BubbleWalk에 표시된 번호와 같은 번호를 선택하세요.', syncDone: 'BubbleWalk가 나의 색으로 빛나고 있어요.',
      reading: '이 기기가 만난 색을 읽는 중…', clearing: '이전 팔레트를 지우는 중…',
      freshReady: '새로운 산책 준비 완료! 색을 만나러 가요.', chooseNext: '색을 고른 뒤 다음 BubbleWalk 기기를 선택하세요.',
    },
    errors: {
      noDevice: '기기가 선택되지 않았습니다. 준비되면 기기 뒷면의 버튼을 누르고 다시 시도하세요.',
      reselect: '이 기기를 다시 선택해야 합니다. 기기 뒷면의 버튼을 누른 뒤 재시도하세요.',
      timeout: 'BubbleWalk가 제시간에 응답하지 않았습니다. 기기 뒷면의 버튼을 누르고 다시 시도하세요.',
      generic: 'BubbleWalk에 연결할 수 없습니다. 기기 뒷면의 버튼을 누르고 가까이 둔 뒤 다시 시도하세요.',
    },
    topics: topic('대학에서 힘쓰고 싶은 것', '대학에서 가장 힘써 보고 싶은 것은 무엇인가요?', '교양이나 기술 배우기', '게임이나 그림 만들기', '친구들과 이어지기'),
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

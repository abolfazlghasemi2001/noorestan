/* نورستان: فهرست واحد بازی‌ها
 * فاز اول فقط قرارداد داده است؛ صفحات فعلی دست‌نخورده می‌مانند.
 * فاز بعدی index.html و بازی‌های مستقل از همین فهرست می‌خوانند.
 */
(function (root) {
  const catalog = [
    {
      id: 'ayah-builder',
      title: 'آیه‌ساز',
      description: 'واژه‌های آیه را پیش از تمام شدن زمان، به ترتیب بچین.',
      subject: 'آیات و سوره‌ها',
      skills: ['چیدن و واژه‌ها', 'سرعت'],
      modes: ['solo'],
      difficulty: ['easy', 'medium', 'hard'],
      duration: '۲ تا ۳ دقیقه',
      timed: true,
      offline: true,
      status: 'available',
      route: 'ayah-builder.html',
      art: 'art/ayah-builder.svg',
      scoreKeys: ['ayahbuilder_1', 'ayahbuilder_2', 'ayahbuilder_3']
    },
    {
      id: 'hadith-rush',
      title: 'باران حکمت',
      description: 'واژهٔ گم‌شدهٔ حدیث را از میان گزینه‌های بارانی بگیر.',
      subject: 'حدیث و حکمت',
      skills: ['سرعت و واکنش', 'واژه'],
      modes: ['solo'],
      difficulty: ['medium', 'hard'],
      duration: '۲ تا ۳ دقیقه',
      timed: true,
      offline: true,
      status: 'available',
      route: 'hadith-rush.html',
      art: 'art/hadith-rush.svg',
      scoreKeys: ['hadithrush']
    },
    {
      id: 'noor-pairs',
      title: 'جفت نور',
      description: 'کارت‌ها را برگردان و هر آیه را به سوره‌اش برسان.',
      subject: 'آیات و سوره‌ها',
      skills: ['حافظه و تمرکز'],
      modes: ['solo'],
      difficulty: ['easy', 'medium'],
      duration: '۲ تا ۴ دقیقه',
      timed: false,
      offline: true,
      status: 'available',
      route: 'noor-pairs.html',
      art: 'art/noor-pairs.svg',
      scoreKeys: ['noorpairs_6', 'noorpairs_6t', 'noorpairs_8', 'noorpairs_8t']
    },
    {
      id: 'knowledge-quiz',
      title: 'آزمون معارف',
      description: 'آزمون‌های موضوعی قرآن، اهل‌بیت، احکام و ایران‌شناسی.',
      subject: 'معارف و دانستنی‌ها',
      skills: ['آزمون و چهارگزینه‌ای'],
      modes: ['solo'],
      difficulty: ['easy', 'medium', 'hard'],
      duration: '۳ تا ۶ دقیقه',
      timed: false,
      offline: true,
      status: 'embedded',
      route: '../#exam',
      art: null,
      scoreKeys: []
    },
    {
      id: 'nahj-quiz',
      title: 'آزمون نهج‌البلاغه',
      description: 'معنی حکمت‌ها و آشنایی با سخنان امام علی (ع).',
      subject: 'نهج‌البلاغه',
      skills: ['آزمون و چهارگزینه‌ای', 'واژه'],
      modes: ['solo'],
      difficulty: ['medium', 'hard'],
      duration: '۳ تا ۵ دقیقه',
      timed: false,
      offline: true,
      status: 'embedded',
      route: '../#nahj',
      art: null,
      scoreKeys: []
    },
    {
      id: 'multiplayer',
      title: 'محفل نور',
      description: 'دوز، اسم‌فامیل و گفت‌وگوی زنده با دیگران.',
      subject: 'چندنفره',
      skills: ['رقابتی', 'چندنفره'],
      modes: ['online'],
      difficulty: ['medium'],
      duration: '۵ تا ۱۵ دقیقه',
      timed: false,
      offline: false,
      status: 'embedded',
      route: '../#lobby',
      art: null,
      scoreKeys: []
    }
  ];

  const byId = id => catalog.find(game => game.id === id) || null;
  const available = () => catalog.filter(game => game.status === 'available');
  const subjects = () => [...new Set(catalog.map(game => game.subject))];
  const filter = ({ subject, skill, mode, status } = {}) => catalog.filter(game =>
    (!subject || game.subject === subject) &&
    (!skill || game.skills.includes(skill)) &&
    (!mode || game.modes.includes(mode)) &&
    (!status || game.status === status)
  );

  root.NoorestanGameCatalog = Object.freeze({
    all: Object.freeze(catalog),
    byId,
    available,
    subjects,
    filter
  });
})(typeof window === 'undefined' ? globalThis : window);

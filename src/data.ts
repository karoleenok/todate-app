export type Category = 'дома' | 'еда' | 'отдых' | 'релакс';

export interface Idea {
  id: string;
  title: string;
  category: Category;
  duration: string;
  price: string;
  metro?: string;
  description?: string;
  secret?: string; // секретный бонус — узнаёт только получатель письма
  shape: 'sun' | 'bottle' | 'pear' | 'leaves';
  /** Имя файла в public/cards без расширения. Если задано — карточка целиком картинка (WebP, углы уже скруглены) */
  image?: string;
}

/** Путь к картинке карточки. Относительный, чтобы работало и на корне домена, и в подпапке */
export const cardSrc = (name: string) => `./cards/${name}.webp`;

/** Строка приглашения: у нарисованных карточек заголовок продолжает «Давай …», у картинок он уже в повелительном наклонении */
export const inviteLine = (i: Idea) =>
  i.image ? i.title : `Давай ${i.title.charAt(0).toLowerCase()}${i.title.slice(1)}`;

/* Названия категорий — как в макете. Ключи внутренние, в интерфейсе везде показываем label */
export const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'дома', label: 'Остаёмся дома' },
  { key: 'еда', label: 'Еда' },
  { key: 'отдых', label: 'Активный отдых' },
  { key: 'релакс', label: 'Релакс' },
];
export const categoryLabel = (c: Category) => CATEGORIES.find((x) => x.key === c)?.label ?? c;

/* Обратная сторона карточки («рубашка») по категории */
export const COVERS: Record<Category, string> = {
  'дома': 'cover-home', 'еда': 'cover-food', 'отдых': 'cover-active', 'релакс': 'cover-relax',
};

/* Сколько закрытых плиток показываем после открытых карточек («пока не открыто») */
export const LOCKED_SLOTS = 2;

export const IDEAS: Idea[] = [
  {
    id: 'ciao-kaiju',
    title: 'Отправляйтесь в «ciao kaiju!» и возьмите итальяно-японскую пиццу и моти-тирамису',
    category: 'еда',
    duration: 'от 30 мин',
    price: 'от 600 ₽',
    shape: 'pear',
    image: 'ciao-kaiju',
  },
  {
    id: 'naedine',
    title: 'Запланируйте фотосессию без фотографа в фотостудии «наедине»',
    category: 'релакс',
    duration: 'от 30 мин',
    price: 'от 600 ₽',
    shape: 'leaves',
    image: 'naedine',
  },
  {
    id: 'geocaching',
    title: 'Попробуйте геокэшинг',
    category: 'отдых',
    duration: 'от 30 мин',
    price: 'от 600 ₽',
    shape: 'sun',
    image: 'geocaching',
  },
  {
    id: 'artist-evening',
    title: 'Устройте вечер одного художника: возьмите холсты с красками и выберите одного из художников, который вам нравится',
    category: 'дома',
    duration: 'от 30 мин',
    price: 'от 600 ₽',
    description:
      'Сделайте свою версию реальной картины, переосмысливая объекты и сюжет (меняйте предметы, контекст, будьте смелыми!)',
    shape: 'leaves',
    image: 'artist-evening',
  },
];

export interface RoutePoint {
  title: string;
  text: string;
  /** Фото места: имя файла в public/places без расширения. Пока фото нет — показывается заглушка */
  photo?: string;
  /** Несколько фото места: имена файлов в public/places без расширения (рядом лежит миниатюра `<имя>-s.webp` для карты) */
  photos?: string[];
}

export interface CityRoute {
  id: string;
  title: string;
  short?: string; // короткое название для карточек, если полное не помещается
  district: string;
  duration: string;
  price: string;
  tags: string[];
  description: string;
  points: RoutePoint[];
  favorite?: boolean;
  hue: number; // оттенок для «фото»
  cover?: string; // обложка маршрута: файл в public/places
}

export const DISTRICTS = ['Петроградка', 'Васильевский', 'Центральный', 'Коломна'];

export const ROUTES: CityRoute[] = [
  {
    id: 'bohemian',
    cover: 'interior',
    title: 'На мне французский для парфюм. Богемный вечер в Питере',
    short: 'Богемный вечер в Питере',
    district: 'Центральный',
    duration: '3 часа',
    price: 'от 600 ₽',
    tags: ['Пешком', 'Плохая погода'],
    description:
      'Маршрут для вечера, когда хочется Парижа, но билетов нет. Три точки вокруг Невского: кофе, духи и джаз.',
    points: [
      { photos: ['schastye-1', 'schastye-2'], title: 'Начинаем наш маршрут взяв кофе в «Счастье»', text: 'Кофейня с видом на Исаакий: берите фильтр и место у окна на втором этаже.' },
      { photos: ['street', 'table'], title: 'Парфюмерный уголок на Большой Конюшенной', text: 'Затестируйте друг на друге три аромата и выберите «запах этого вечера».' },
      { photos: ['interior'], title: 'Финал — джаз в подвале на Мойке', text: 'Камерный бар с живой музыкой по выходным, столики лучше бронировать до 18:00.' },
    ],
    favorite: true,
    hue: 20,
  },
  {
    id: 'american-vibe',
    cover: 'underpass',
    title: 'American vibe в Петербурге',
    district: 'Петроградка',
    duration: '2,5 часа',
    price: 'от 600 ₽',
    tags: ['Пешком'],
    description:
      'Нью-Йорк на минималках: кирпичные лофты, смузи-боулы и кино на крыше. Маршрут для тех, кто скучает по большому городу.',
    points: [
      { photos: ['underpass'], title: 'Лофт-квартал у Кронверкского', text: 'Кирпичные фасады и огненные лестницы — лучший фон для совместных фото.' },
      { photos: ['interior', 'table'], title: 'Дайнер с молочными коктейлями', text: 'Чизбургеры, клетчатые скатерти и джукбокс в углу.' },
      { photos: ['teapot'], title: 'Кинопоказ под открытым небом', text: 'Летние показы на крыше: пледы выдают у входа, берите два.' },
    ],
    favorite: true,
    hue: 350,
  },
  {
    id: 'kolomna',
    cover: 'bridge',
    title: 'Коломна: театр, вода и семь мостиков',
    district: 'Коломна',
    duration: '2 часа',
    price: 'от 0 ₽',
    tags: ['Пешком', 'Бесплатно'],
    description:
      'Самый «питерский» район: тихие набережные, дворы-колодцы и мостики через Крюков канал. Бюджет — по желанию.',
    points: [
      { photos: ['bridge'], title: 'Мост Поцелуев', text: 'Классика: поцелуй на мосту «на вечность». Дальше — вдоль воды к Новой Голландии.' },
      { photos: ['street'], title: 'Двор у Мариинского театра', text: 'Загляните в афиши: иногда бывают льготные билеты на дневные спектакли.' },
      { photos: ['table', 'teapot'], title: 'Пироговый дворик на Декабристов', text: 'Пироги с капустой и чай из самовара — финал в лучших традициях.' },
    ],
    hue: 200,
  },
  {
    id: 'vasilevsky',
    cover: 'isaac-table',
    title: 'Васильевский: стрелка, львы и закат над Невой',
    district: 'Васильевский',
    duration: '2 часа',
    price: 'от 300 ₽',
    tags: ['Пешком'],
    description:
      'От Леонтьевского мысли до стрелки: львы, ростральные колонны и самый широкий закат в городе.',
    points: [
      { photos: ['bridge'], title: 'Египетские львы на набережной', text: 'Легенда: потрите льву лапу — и неделя будет доброй.' },
      { photos: ['isaac-table'], title: 'Стрелка Васильевского острова', text: 'Лучшая точка на закат: приходите за 40 минут до солнца.' },
      { photos: ['teapot'], title: 'Мороженое на 6-й линии', text: 'Финишная точка — пломбир в вафельном стакане, как в детстве.' },
    ],
    hue: 260,
  },
];

export type EventCategory = 'музыка' | 'кино' | 'выставки' | 'лекции' | 'еда' | 'игры';
export const EVENT_CATEGORIES: { key: EventCategory; label: string }[] = [
  { key: 'музыка', label: 'Музыка' },
  { key: 'кино', label: 'Кино' },
  { key: 'выставки', label: 'Выставки' },
  { key: 'лекции', label: 'Лекции' },
  { key: 'еда', label: 'Еда и маркеты' },
  { key: 'игры', label: 'Игры и мастер-классы' },
];

export interface CityEvent {
  id: string;
  title: string;
  dayOffset: number; // день недели: 0 — понедельник, 6 — воскресенье
  time: string;
  price: string;
  place: string;
  category: EventCategory;
  description: string;
  hue: number;
  pick?: boolean; // «Выбор To Date»
  link?: string; // страница партнёра: сайт, телеграм-канал, афиша
  photo?: string; // файл в public/events
  sponsored?: boolean; // рекламное размещение партнёра (по закону нужна пометка «Реклама»)
}

// Дни привязаны к неделе, поэтому афиша не устаревает; тексты и места — демо
export const EVENTS: CityEvent[] = [
  { id: 'candlelight', title: 'Candlelight: саундтреки при свечах', dayOffset: 5, time: '20:00', price: 'от 1 500 ₽', place: 'Капелла', category: 'музыка', pick: true, photo: 'concert',
    description: 'Струнный квартет играет музыку из кино в зале, освещённом тысячей свечей.', hue: 35 },
  { id: 'market', title: 'Маркет локальных брендов «Сезон»', dayOffset: 5, time: '12:00', price: 'бесплатно', place: 'Севкабель Порт', category: 'еда', pick: true, sponsored: true,
    description: 'Керамика, свечи, винтаж и уличная еда. Можно найти подарок «просто так».', hue: 150 },
  { id: 'lecture', title: 'Лекция «Как читать Питер по вывескам»', dayOffset: 2, time: '19:30', price: 'от 500 ₽', place: 'Дом радио', category: 'лекции', pick: true,
    description: 'История города через шрифты, адреса и детали, которые мы не замечаем.', hue: 210 },
  { id: 'degust', title: 'Дегустация северной кухни', dayOffset: 4, time: '19:00', price: 'от 2 500 ₽', place: 'Ресторан «Береста»', category: 'еда',
    description: 'Пять подач из местных продуктов: гольцы, брусника, хлеб на закваске.', hue: 25 },
  { id: 'boardgames', title: 'Ночь настолок для пар', dayOffset: 4, time: '21:00', price: 'от 400 ₽', place: 'Антикафе «Зелёная комната»', category: 'игры',
    description: 'Командные и парные игры, ведущий и неограниченный чай с печеньем.', hue: 90 },
];

export interface Note {
  id: string;
  author: string;
  text: string;
  contact: string;
}

export const NOTES: Note[] = [
  { id: 'n1', author: 'Катя и Марк', text: 'Ведём телеграм-канал о небанальных местах Питера. Загляните, если любите заброшки и крыши.', contact: '@spb_hidden' },
  { id: 'n2', author: 'Антон', text: 'Ищу компанию на утренние пробежки по Елагину. Темп спокойный, кофе после — святое.', contact: '@anton_run' },
  { id: 'n3', author: 'Мастерская «Глина»', text: 'Парные занятия по керамике на Петроградке. За два часа сделаете по кружке — и друг другу.', contact: 'glina.spb' },
];

export const PLANS = [
  { id: 'week', title: 'Неделя', price: '299 ₽', per: 'попробовать', days: 7 },
  { id: 'month', title: 'Месяц', price: '690 ₽', per: '≈ 23 ₽ в день', days: 30 },
  { id: 'quarter', title: '3 месяца', price: '1 590 ₽', per: '≈ 18 ₽ в день', days: 90, best: true },
];

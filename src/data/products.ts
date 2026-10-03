export type Unit = 'кг' | 'шт'

export type CategoryId =
  | 'sausages'
  | 'links'
  | 'delicacies'
  | 'prepared'
  | 'dairy'

export type Product = {
  id: string
  name: string
  category: CategoryId
  price: number
  unit: Unit
  note?: string
  badge?: 'hit' | 'sale' | 'new'
  image: string
}

export const categories: { id: CategoryId; title: string; blurb: string }[] = [
  {
    id: 'sausages',
    title: 'Колбасы',
    blurb: 'Фермерские и классические — вареные, копчёные, запечённые',
  },
  {
    id: 'links',
    title: 'Сосиски и колбаски',
    blurb: 'На завтрак и для гриля — говяжьи, молочные, украинские',
  },
  {
    id: 'delicacies',
    title: 'Деликатесы',
    blurb: 'Грудинка, буженина, рулеты, сало в специях',
  },
  {
    id: 'prepared',
    title: 'Под заказ и готовое',
    blurb: 'Заливное, холодец, пельмени ручной лепки',
  },
  {
    id: 'dairy',
    title: 'Сыры и молочное',
    blurb: 'Авторские сыры, масло, творожные сырки',
  },
]

export const products: Product[] = [
  {
    id: 'krakow-premium',
    name: 'Краковская «Премиум»',
    category: 'sausages',
    price: 670,
    unit: 'кг',
    badge: 'hit',
    image: '/images/case-4.jpg',
  },
  {
    id: 'krakow',
    name: 'Краковская',
    category: 'sausages',
    price: 670,
    unit: 'кг',
    image: '/images/case-4.jpg',
  },
  {
    id: 'turkey-cheese',
    name: 'Колбаса индюшачья с сыром',
    category: 'sausages',
    price: 830,
    unit: 'кг',
    badge: 'new',
    image: '/images/case-4.jpg',
  },
  {
    id: 'wood-baked',
    name: 'Колбаса печёная на дровах',
    category: 'sausages',
    price: 745,
    unit: 'кг',
    image: '/images/case-4.jpg',
  },
  {
    id: 'farmers',
    name: 'Фермерская',
    category: 'sausages',
    price: 370,
    unit: 'кг',
    badge: 'sale',
    image: '/images/case-3.jpg',
  },
  {
    id: 'beef-garlic',
    name: 'Говяжья с чесноком',
    category: 'sausages',
    price: 410,
    unit: 'кг',
    image: '/images/case-3.jpg',
  },
  {
    id: 'beef-sausages',
    name: 'Сосиски говяжьи',
    category: 'links',
    price: 560,
    unit: 'кг',
    image: '/images/case-1.jpg',
  },
  {
    id: 'milk-sausages',
    name: 'Сосиски молочные',
    category: 'links',
    price: 390,
    unit: 'кг',
    image: '/images/case-1.jpg',
  },
  {
    id: 'ukrainian',
    name: 'Колбаски украинские',
    category: 'links',
    price: 600,
    unit: 'кг',
    badge: 'hit',
    image: '/images/case-1.jpg',
  },
  {
    id: 'brisket',
    name: 'Грудинка',
    category: 'delicacies',
    price: 685,
    unit: 'кг',
    image: '/images/case-1.jpg',
  },
  {
    id: 'buzhenina',
    name: 'Буженина',
    category: 'delicacies',
    price: 775,
    unit: 'кг',
    image: '/images/case-1.jpg',
  },
  {
    id: 'lard-spices',
    name: 'Сало в специях',
    category: 'delicacies',
    price: 690,
    unit: 'кг',
    image: '/images/case-1.jpg',
  },
  {
    id: 'chicken-roll',
    name: 'Рулет куриный с грибами',
    category: 'delicacies',
    price: 785,
    unit: 'кг',
    badge: 'hit',
    image: '/images/case-1.jpg',
  },
  {
    id: 'liver-roll',
    name: 'Рулет с печенью',
    category: 'delicacies',
    price: 650,
    unit: 'кг',
    image: '/images/case-4.jpg',
  },
  {
    id: 'kholodets-beef',
    name: 'Холодец говяжий с горчицей',
    category: 'prepared',
    price: 220,
    unit: 'шт',
    image: '/images/case-3.jpg',
  },
  {
    id: 'kholodets-pork',
    name: 'Холодец свиной с горчицей',
    category: 'prepared',
    price: 180,
    unit: 'шт',
    image: '/images/case-3.jpg',
  },
  {
    id: 'zalivnoe-tongue',
    name: 'Заливное с языком',
    category: 'prepared',
    price: 740,
    unit: 'кг',
    image: '/images/case-3.jpg',
  },
  {
    id: 'zalivnoe-goose',
    name: 'Заливное гусиное с овощами',
    category: 'prepared',
    price: 500,
    unit: 'кг',
    image: '/images/case-3.jpg',
  },
  {
    id: 'cod-liver',
    name: 'Печень трески натуральная',
    category: 'prepared',
    price: 620,
    unit: 'шт',
    image: '/images/case-3.jpg',
  },
  {
    id: 'black-cheese',
    name: 'Сыр чёрный с цедрой лимона',
    category: 'dairy',
    price: 1060,
    unit: 'кг',
    badge: 'new',
    image: '/images/case-2.jpg',
  },
  {
    id: 'hemp-cheese',
    name: 'Сыр с семенами конопли',
    category: 'dairy',
    price: 1055,
    unit: 'кг',
    badge: 'new',
    image: '/images/case-2.jpg',
  },
  {
    id: 'butter',
    name: 'Масло традиционное 82,5%',
    category: 'dairy',
    price: 550,
    unit: 'шт',
    note: '500 г',
    image: '/images/case-2.jpg',
  },
  {
    id: 'cream-cheese',
    name: 'Сыр творожный Bonfesta',
    category: 'dairy',
    price: 165,
    unit: 'шт',
    note: '140 г',
    image: '/images/case-2.jpg',
  },
]

export const shop = {
  name: 'РАЗ!Колбас',
  shortName: 'Раз!Колбас56',
  tagline: 'Фермерские продукты',
  city: 'Оренбург',
  phone: '+79128462244',
  phoneDisplay: '+7 (912) 846-22-44',
  contact: 'Андрей',
  audience: '606+',
  // Подставьте ссылку на чат Max из настроек профиля, когда будет готова
  maxChatUrl: '',
  features: [
    'Мясо и специи — без лишней химии',
    'Доставка по Оренбургу',
    'Без предоплаты',
    'Под заказ: пельмени, заливное, нарезка',
  ],
}

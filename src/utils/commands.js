import { PROJECTIONS } from '../data/projections.js'
import { searchGeography } from '../data/geography.js'

const aliases = [
  ['横轴墨卡托', 'transverseMercator'],
  ['高斯', 'transverseMercator'],
  ['兰伯特等角', 'lambertConformal'],
  ['兰伯特方位', 'lambertAzimuthal'],
  ['阿尔伯斯', 'albers'],
  ['高尔彼得斯', 'gallPeters'],
  ['高尔－彼得斯', 'gallPeters'],
  ['温克尔三重', 'winkelTripel'],
  ['摩尔魏特', 'mollweide'],
  ['桑逊', 'sinusoidal'],
  ['正弦曲线', 'sinusoidal'],
  ['极地立体', 'polarStereographic'],
  ['多圆锥', 'polyconic'],
  ['自然地球', 'naturalEarth'],
  ['等地球', 'equalEarth'],
  ['方位等距', 'azimuthalEquidistant'],
  ['正射', 'orthographic'],
  ['球心', 'gnomonic'],
  ['罗宾逊', 'robinson'],
  ['墨卡托', 'mercator'],
]

const purposeWords = {
  statistics: ['统计', '面积', '人口', '经济', '专题'],
  aviation: ['气象', '航空', '保形', '角度'],
  topographic: ['地形图', '大比例尺', '测绘', '分带'],
  navigation: ['航海', '导航', '航向'],
  wallMap: ['挂图', '世界地图', '教学演示', '全球'],
  polar: ['极地', '科考', '北极', '南极'],
}

export function parseMapCommand(input) {
  const text = input.trim()
  if (!text) {
    return { ok: false, message: '请输入一条制图指令。' }
  }

  const mentioned = []
  const scanned = text.toLowerCase()
  for (const [alias, id] of aliases) {
    if (scanned.includes(alias.toLowerCase()) && !mentioned.includes(id)) mentioned.push(id)
  }

  const compare = /对比|比较|并排/.test(text)
  const purpose = Object.entries(purposeWords).find(([, words]) =>
    words.some((word) => text.includes(word)),
  )?.[0]
  const region = /世界|全球/.test(text)
    ? 'world'
    : /分省|省界|省级/.test(text)
      ? 'chinaProvinces'
      : /中国|全国|国内/.test(text)
        ? 'chinaFull'
        : null

  const geoMatch = text.match(
    /(?:在|绘制|查看|投影)\s*([\u4e00-\u9fa5]{2,8})(?:的|区域|范围|地图)?/,
  )
  const geoCandidate = geoMatch?.[1] ? searchGeography(geoMatch[1])[0] : null

  return {
    ok: true,
    text,
    compare,
    projections: mentioned.slice(0, 2),
    purpose: purpose ?? null,
    region: region ?? geoCandidate?.region ?? (geoCandidate ? 'world' : null),
    extent: geoCandidate?.extent ?? null,
    place: geoCandidate?.name ?? null,
    message:
      mentioned.length || purpose || region || geoCandidate
        ? '已解析指令，可在投影实验室中应用。'
        : '没有识别到明确的投影、用途或区域，请尝试“对比阿尔伯斯和墨卡托在中国的变形”。',
  }
}

export function projectionName(id) {
  return PROJECTIONS.find((projection) => projection.id === id)?.name ?? id
}

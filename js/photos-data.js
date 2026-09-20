// ============ 相片集 · 数据源 ============
// 补充/修改相片只改这个文件：网格自动生成，无需动 HTML 和 main.js。
// 字段说明：
//   title 卡片标题
//   desc  一句话描述
//   img   真实相片路径（如 'images/photos/xxx.webp'），懒加载：进入视口才请求
//   grad  占位渐变类 g1~g6（无 img 时生效，对应 style.css 里的 .g1~.g6）
// 卡片尺寸由 style.css 的 #photos 区段统一规范（3/4 竖版、contain 完整展示），无需逐条配置。
const PHOTOS_DATA = [
  { title: '春日花影', desc: '镜头里的一朵花', img: 'images/photos/flower.webp', grad: 'g1' },
  { title: '相片一号', desc: '晴朗的一天', grad: 'g1' },
  { title: '相片二号', desc: '海边的风', grad: 'g2' },
  { title: '相片三号', desc: '傍晚的云', grad: 'g3' },
  { title: '相片四号', desc: '街角的咖啡', grad: 'g4' },
  { title: '相片五号', desc: '山间的小路', grad: 'g5' },
  { title: '相片六号', desc: '城市灯火', grad: 'g6' },
];

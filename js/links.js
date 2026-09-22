// ============ 站点身份集中配置 ============
// 名字与版权年份在此统一维护，全站页脚/署名由 main.js 自动读取，避免多处写死。
const SITE = {
  name: '真名有寻',     // 名字
  year: '2026',       // 版权年份
  motto: '记录学习、作品与生活的一片小园地。',  // 首页轮播占位帧副标语
};

// ============ 首页轮播横幅配置 ============
// 通栏轮播的帧数据；src 省略时该帧渲染为品牌渐变占位帧。
// 有了横幅大图后按格式追加即可，例如：
//   { src: 'images/banner/1.webp', caption: '站点新装上线' },
const CAROUSEL = [];

// ============ 社交链接集中配置 ============
// 首页头像下方的图标使用；键名对应 index.html 中 data-social 的值。改成你的真实主页地址即可。
const SOCIAL = {
  bilibili: 'https://space.bilibili.com/0',  // 替换为你的 B 站主页
  github: 'https://github.com/your-name',    // 替换为你的 GitHub 主页
};

// ============ 作品外链集中配置 ============
// 把所有作品的在线链接抽离到这里，方便你集中填充/替换。
// 使用方式：把下面的值改成你作品对应的真实部署地址即可，作品页会自动读取。
const WORK_LINKS = {
  // 作品一号 · 海屿·旅记
  works1: 'https://d.zmyxun.top', 
  // 作品二号
  works2: 'https://github.com/sjsj755/hot-tool', 
  // 作品三号
  works3: 'https://c.zmyxun.top', 
  // 作品四号
  works4: 'https://rokoking-dev.netlify.app', 
  // 作品五号
  works5: 'https://github.com/sjsj755/bilinili-zhibo',
};
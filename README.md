# 经纬之间 · 地图投影教学实验室

目标部署地址：

```text
https://xunxun-77.github.io/MapLab/
```

GitHub 用户名：`xunxun-77`  
GitHub 仓库名：`MapLab`

纯前端 WebGIS 教学网站，面向高校 GIS 和地理专业学生。所有投影、坐标、推荐和专题制图计算都在浏览器内完成，不需要后端、数据库、登录或 API Key。

## 直接打开

已构建好的单文件版本：

```text
dist/index.html
```

双击即可在浏览器中运行。CSS、JavaScript、地图数据和第三方依赖均已内联，不依赖本地服务器。

如果修改了源码，需要重新运行 `npm run build` 更新单文件版本。

## 功能

### 投影实验室

- 18 种投影：墨卡托、横轴墨卡托（高斯－克吕格）、兰伯特等角圆锥、阿尔伯斯等积圆锥、方位等距、极地立体、兰伯特方位等积、等距圆柱、高尔－彼得斯、罗宾逊、温克尔三重、摩尔魏特、桑逊正弦曲线、多圆锥、正射方位、球心投影、自然地球和等地球。
- 单图与 A/B 并排对比。
- 调整中央经线、中心纬度、标准纬线，修改后实时重绘。
- 滚轮缩放、按钮缩放、视野重置和拖动平移。
- 地图拖拽框选制图范围，自动读取四至坐标。
- 经纬网、国界、省界、城市点、变形圆、坐标点、图例、比例尺和外轮廓图层。
- 每种投影展示类型、性质、中国全图适用性、推荐用途、变形特点和不适用场景。
- SVG 导出和地图点击读点。

### 投影推荐

- 中国全图、中国分省、世界全图预设。
- 国家、省级行政区和城市本地搜索。
- 手动输入 `minLon, maxLon, minLat, maxLat` 四至。
- 六种地图用途。
- 本地规则推荐与“模拟大模型增强”两种排序方式。
- 推荐参数、理由、优点、缺点和中国适用性。

### 自然语言控制

前端关键词和规则解析，不调用大模型：

- “给中国全图选统计专题图投影”
- “对比阿尔伯斯和墨卡托在中国的变形”
- “用极地立体查看北极科考范围”

### 专题制图

- 中国省级单元或世界国家单元。
- 等间隔和分位数分级。
- 三套色带。
- 面透明度、描边颜色、描边宽度和点符号大小。
- 地图标题、字号、标题位置、图例位置和比例尺位置。
- 当前地图导出 PNG，并包含图题、图例和示意比例尺。

### 辅助页面

- 坐标正算、反算与球面回环误差。
- 局部面积倍率、主次尺度、角度变形和经线收敛角。
- 18 种投影知识库和筛选卡片。
- 每种投影的知识点弹窗。

## 本地开发

```powershell
npm install
npm run dev
```

默认地址为 `http://127.0.0.1:5173/`。

构建单文件静态版本：

```powershell
npm run build
```

运行浏览器自动检查：

```powershell
# 先在另一个终端运行 npm run dev
npm run verify
```

检查内容包括：

- 18 种投影均可渲染；
- 34 个省界要素及 10 段断续线存在；
- 地图点击、框选、滚轮缩放正常；
- 18 种投影的坐标正算无错误；
- 自然语言对比和规则推荐正常；
- 桌面端和移动端无横向溢出；
- 浏览器运行错误为零。

## 部署到 xunxun-77.github.io/MapLab

1. 登录 GitHub，在账号 `xunxun-77` 下创建公开仓库 `MapLab`。
2. 打开仓库 `Settings` → `Pages`。
3. 在 `Build and deployment` 中将 Source 设置为 `GitHub Actions`。
4. 在本项目目录提交并推送源码：

```powershell
git init -b main
git add .
git commit -m "Deploy MapLab"
git remote add origin https://github.com/xunxun-77/MapLab.git
git push -u origin main
```

5. `.github/workflows/deploy.yml` 会构建单文件站点并发布 `dist`。
6. 等待 Actions 页面出现绿色对勾后，访问：

```text
https://xunxun-77.github.io/MapLab/
```

首次部署通常需要几分钟。如果地址仍是 404，请检查：

- 仓库名是否为 `MapLab`；
- Settings → Pages 的 Source 是否为 `GitHub Actions`；
- Actions 中的部署任务是否成功；
- 仓库是否为私有且当前账号没有 GitHub Pages 权限。

也可以直接把 `dist/index.html` 上传到任意静态托管平台。`vite.config.js` 已设置相对资源路径，项目页部署在子目录下也能正常访问。

## 目录

```text
src/
├─ App.vue                      页面外壳、状态和本地记忆
├─ components/
│  ├─ LabView.vue               紧凑的投影实验室工作区
│  ├─ WorldMap.vue              SVG 地图、缩放、平移、框选和导出
│  ├─ RecommendationPanel.vue   区域、搜索、用途与推荐
│  ├─ CommandPanel.vue          自然语言规则解析
│  ├─ ThematicView.vue          分级设色、符号与图面整饰
│  ├─ CompareView.vue           独立并排比较页
│  ├─ CoordinateView.vue        坐标工作台
│  └─ GuideView.vue             投影知识和筛选总览
├─ data/
│  ├─ geography.js              世界、中国、区域、城市和搜索索引
│  └─ projections.js            18 种投影及完整说明
├─ utils/
│  ├─ projection.js             参数、拟合、坐标和变形计算
│  ├─ recommendation.js         本地规则推荐
│  ├─ commands.js               自然语言关键词解析
│  └─ extent.js                 四至校验
└─ styles.css                   学术风界面和响应式布局
```

## 地图数据

中国省级边界、南海断续线和世界国家边界来自 `chinese-global-compliant-geodata@1.0.0`，该包以 MIT 许可发布，包内说明其中国数据整理自天地图。

数据提取细节、版权和许可见 [DATA-NOTICE.md](public/DATA-NOTICE.md)。

本项目只用于教学演示。正式公开出版、登载或提供地图服务前，仍应按现行标准地图管理规定使用符合业务要求的权威底图，并完成审核或备案。

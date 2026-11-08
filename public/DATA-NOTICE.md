# 地图数据说明

本项目的中国省级边界和南海断续线来自 npm 包：

- `chinese-global-compliant-geodata@1.0.0`
- 项目主页：https://github.com/JayMuShui/chinese-global-compliant-geodata
- 数据整理来源：中国国家地理信息公共服务平台“天地图”
- 数据更新时间：包内说明标注为 2024 年 5 月
- 参考文件：`dist/src/geojson/countries/as/chn/global/chn-level-1.json`

本项目从中提取：

- 34 个省级行政区的 `MultiPolygon` 几何；
- 数据中由 10 条线串组成、覆盖南海及台湾以东方向的“境界线”要素；
- 世界国家边界 `globe/world.json`。

数据源为 MIT 许可。使用或再分发时请保留原作者版权声明和许可文本。

> 注意：本项目是教学软件，不替代主管部门发布的标准地图。面向公众正式出版、登载或提供地图服务前，仍应按现行标准地图管理规定完成审核、备案，并使用符合具体业务要求的权威底图。

## MIT License

Copyright (c) 2025 JayMuShui

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

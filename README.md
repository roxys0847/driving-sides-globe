# 世界通行方向

**中文 · [English](./README.en.md)**

通过一个可交互的立体地球仪，探索世界各国和地区的车辆靠左还是靠右行驶。

🌐 **[打开在线网站](https://repeak.dpdns.org)**

地图使用不同颜色区分国家和地区，并用斜向阴影直观表示通行方向：阴影朝左上代表左侧通行，阴影朝右下代表右侧通行。

## 功能特点

- 可交互的地球仪，支持自动旋转、手动旋转和缩放
- 使用不同颜色和方向阴影区分左侧通行与右侧通行
- 国家和地区名称以中文为主、英文为辅，并显示对应旗帜
- 支持搜索国家和地区，包括澳门等面积较小的区域
- 详情面板显示旗帜、中英文名称和车辆通行方向
- 支持按左侧通行或右侧通行筛选，并实时显示地图区域数量
- 打开网站时申请浏览器定位权限，初始视角以当前位置为中心并显示位置标记
- 适配桌面端和手机端
- 触屏设备支持单指旋转和双指捏合缩放
- 支持减少动态效果设置，并为交互控件提供无障碍标签

## 使用方法

### 桌面端

- 拖动地球仪进行旋转。
- 使用鼠标滚轮或 `+`、`−` 按钮缩放。
- 点击暂停按钮可暂停或继续自动旋转。
- 在搜索框中查找国家或地区。
- 点击国家或地区可查看详情，不会强制将地球仪跳转到该区域中心。

### 手机端

- 单指拖动可旋转地球仪。
- 双指捏合可放大或缩小。
- 允许定位权限后，初始视角会以当前位置为中心，并在地图上显示位置标记。

## 通行方向图例

| 通行方向 | 视觉标识 |
| --- | --- |
| 左侧通行 | 青色系区域，阴影朝左上 `↖` |
| 右侧通行 | 橙色系区域，阴影朝右下 `↘` |

## 技术栈

- [React](https://react.dev/) 与 [vinext](https://github.com/cloudflare/vinext)
- 使用 [D3 Geo](https://d3js.org/d3-geo) 进行地理投影和路径绘制
- 使用 [TopoJSON](https://github.com/topojson/topojson-client) 与 [world-atlas](https://github.com/topojson/world-atlas) 提供地图数据
- 使用 HTML Canvas 绘制地球仪并处理交互
- 使用 OpenAI Sites 托管网站

## 本地开发

### 环境要求

- Node.js `>=22.13.0`

### 启动项目

```bash
npm install
npm run dev
```

### 验证项目

```bash
npm run build
npm test
```

## 项目结构

- `app/page.tsx`：地球仪绘制、交互、搜索、筛选和定位功能
- `app/country-names.ts`：国家和地区名称及代码映射
- `app/globals.css`：响应式布局和视觉样式
- `.openai/hosting.json`：OpenAI Sites 项目配置

## 在线版本

- 网站：[https://repeak.dpdns.org](https://repeak.dpdns.org)
- GitHub 发行版：[v1.0.0](https://github.com/roxys0847/driving-sides-globe/releases/tag/v1.0.0)

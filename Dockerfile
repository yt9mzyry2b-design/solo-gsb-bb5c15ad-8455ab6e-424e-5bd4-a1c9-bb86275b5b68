FROM node:20-alpine

ENV NODE_ENV=production

WORKDIR /app

# 先装依赖（利用镜像层缓存）
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# 再拷贝应用代码
COPY server.js ./
COPY lib ./lib
COPY public ./public

EXPOSE 3000

# 启动即完成初始化（静态页面 + API 服务）
CMD ["node", "server.js"]

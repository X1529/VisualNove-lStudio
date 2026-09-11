# Dockerfile — Production for VisualNovelStudio (Node 20 LTS)
FROM node:20-alpine AS base
WORKDIR /app
# ติดตั้ง dependencies ที่ต้อง compile (ไม่มี native ใช้ alpine ได้เลย)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
# สร้าง user ไม่ใช่ root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=base /app/node_modules ./node_modules
COPY package.json server.js dialogue-store.js ./
COPY src ./src
COPY public ./public
# data/dialogues ต้องคงอยู่ข้าม restart — ใช้ volume
RUN mkdir -p public/assets/characters public/assets/backgrounds public/assets/bgm public/assets/sfx public/assets/covers data/dialogues && chown -R appuser:appgroup /app
USER appuser
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://localhost:3000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server.js"]

# Dockerfile of atmm-app-frontend
# Этап 1: Сборка
FROM node:20-alpine AS build
WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./
RUN npm install

# Копируем исходный код и собираем проект
COPY . .
RUN npm run build -- --configuration production

# Этап 2: Раздача статики через Nginx
FROM nginx:stable-alpine

# Копируем собранное приложение из первого этапа
COPY --from=build /app/dist/atmm-app-frontend/browser /usr/share/nginx/html

# Копируем кастомный конфиг для работы Angular Routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
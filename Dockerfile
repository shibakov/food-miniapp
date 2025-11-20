# Базовый образ с Nginx
FROM nginx:alpine

# Копируем всё содержимое репо как статику
COPY . /usr/share/nginx/html

# Стандартный порт
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

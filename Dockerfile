FROM nginx:alpine

ENV PORT=8080

# Удаляем дефолтный конфиг
RUN rm /etc/nginx/conf.d/default.conf

# Создаём новый конфиг, который слушает нужный порт
RUN echo "server { \
    listen ${PORT}; \
    server_name _; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { try_files \$uri \$uri/ =404; } \
}" > /etc/nginx/conf.d/default.conf

COPY . /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]

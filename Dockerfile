FROM nginx:alpine

# Railway передаёт номер порта в переменной PORT
ENV PORT 8080

# Меняем конфигурацию nginx, чтобы он слушал именно этот порт
RUN sed -i "s/listen       80;/listen       ${PORT};/" /etc/nginx/conf.d/default.conf

# Кладем статические файлы
COPY . /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]

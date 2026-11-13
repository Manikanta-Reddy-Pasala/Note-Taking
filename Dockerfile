FROM nginx:1.27-alpine
COPY index.html live.js /usr/share/nginx/html/
COPY vendor/ /usr/share/nginx/html/vendor/
EXPOSE 80

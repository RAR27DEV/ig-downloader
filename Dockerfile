FROM node:18

# buat folder kerja
WORKDIR /app

# copy semua file
COPY . .

# install yt-dlp binary Linux
RUN apt-get update && apt-get install -y curl \
    && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod +x /usr/local/bin/yt-dlp

# install dependencies
RUN npm install --omit=dev

# expose port
EXPOSE 3000

# start server
CMD ["node", "server.js"]

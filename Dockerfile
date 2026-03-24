FROM ghcr.io/puppeteer/puppeteer:21.6.1

WORKDIR /app

COPY package*.json ./

USER root
RUN npm install

COPY . .

USER pptruser

EXPOSE 3000

CMD ["node", "server.js"]

FROM node:14.17.6-alpine

WORKDIR /app

ARG NODE_ENV
ARG REACT_APP_BACKEND_URL

ENV NODE_ENV $NODE_ENV
ENV REACT_APP_BACKEND_URL $REACT_APP_BACKEND_URL

ENV PATH /app/node_modules/.bin:$PATH
COPY . /app/

RUN echo "NODE_ENV=${NODE_ENV}" > .env
RUN echo "REACT_APP_BACKEND_URL=${REACT_APP_BACKEND_URL}" >> .env

RUN npm install --silent

RUN npm run build --silent

EXPOSE 3333

CMD ["node", "server.js"]
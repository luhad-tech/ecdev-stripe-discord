FROM node:18-alpine
WORKDIR /src
COPY package.json yarn.lock ./
RUN yarn --frozen-lockfile
COPY . .
EXPOSE 9925:9925
CMD yarn start
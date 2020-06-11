export default class Logger {
  log(message: any, ...optinalParams: any[]) {
    console.log(message, ...optinalParams);
  }

  info(message: any, ...optinalParams: any[]) {
    console.info(message, ...optinalParams);
  }

  warn(message: any, ...optinalParams: any[]) {
    console.warn(message, ...optinalParams);
  }

  error(message: any, ...optinalParams: any[]) {
    console.error(message, ...optinalParams);
  }
}

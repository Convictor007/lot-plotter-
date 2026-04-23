/** Metro must bundle `jspdf/dist/jspdf.es.min.js`; package root resolves to node build. */
declare module 'jspdf/dist/jspdf.es.min.js' {
  export { jsPDF } from 'jspdf';
}

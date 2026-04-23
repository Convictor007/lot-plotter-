import Papa from 'papaparse';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

export interface ParsedCorner {
  ns: string;
  deg: string;
  min: string;
  ew: string;
  distance: string;
}

export const parseLotCsv = async (uri: string, fileObject?: any): Promise<ParsedCorner[]> => {
  let text = '';
  
  if (Platform.OS === 'web' && fileObject) {
    text = await fileObject.text();
  } else {
    // Native read
    text = await FileSystem.readAsStringAsync(uri);
  }

  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const corners: ParsedCorner[] = [];
        for (const row of results.data as any[]) {
          // Flexible mapping for common CSV columns
          const ns = (row['NS'] || row['N/S'] || row['Direction 1'] || '').toString().trim().toUpperCase();
          const deg = (row['Deg'] || row['Degree'] || row['Degrees'] || '').toString().replace(/[^\d]/g, '');
          const min = (row['Min'] || row['Minute'] || row['Minutes'] || '').toString().replace(/[^\d]/g, '');
          const ew = (row['EW'] || row['E/W'] || row['Direction 2'] || '').toString().trim().toUpperCase();
          const distance = (row['Dist'] || row['Distance'] || row['Length'] || '').toString().replace(/[^\d.]/g, '');

          if ((ns === 'N' || ns === 'S') && deg && min && (ew === 'E' || ew === 'W') && distance) {
            corners.push({ ns, deg, min, ew, distance });
          }
        }
        resolve(corners);
      },
      error: (error: any) => {
        reject(error);
      }
    });
  });
};

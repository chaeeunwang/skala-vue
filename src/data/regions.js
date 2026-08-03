export const provinces = [
  {
    id: 'seoul',
    sourceName: '서울특별시',
    name: '서울특별시',
    shortName: '서울',
    file: '서울특별시_시군구_경계.svg',
  },
  {
    id: 'busan',
    sourceName: '부산광역시',
    name: '부산광역시',
    shortName: '부산',
    file: '부산광역시_시군구_경계.svg',
  },
  {
    id: 'daegu',
    sourceName: '대구광역시',
    name: '대구광역시',
    shortName: '대구',
    file: '대구광역시_시군구_경계.svg',
  },
  {
    id: 'incheon',
    sourceName: '인천광역시',
    name: '인천광역시',
    shortName: '인천',
    file: '인천광역시_시군구_경계.svg',
  },
  {
    id: 'gwangju',
    sourceName: '광주광역시',
    name: '광주광역시',
    shortName: '광주',
    file: '광주광역시_시군구_경계.svg',
  },
  {
    id: 'daejeon',
    sourceName: '대전광역시',
    name: '대전광역시',
    shortName: '대전',
    file: '대전광역시_시군구_경계.svg',
  },
  {
    id: 'ulsan',
    sourceName: '울산광역시',
    name: '울산광역시',
    shortName: '울산',
    file: '울산광역시_시군구_경계.svg',
  },
  {
    id: 'sejong',
    sourceName: '세종특별자치시',
    name: '세종특별자치시',
    shortName: '세종',
    file: '세종특별자치시_시군구_경계.svg',
  },
  {
    id: 'gyeonggi',
    sourceName: '경기도',
    name: '경기도',
    shortName: '경기',
    file: '경기도_시군구_경계.svg',
  },
  {
    id: 'gangwon',
    sourceName: '강원도',
    name: '강원특별자치도',
    shortName: '강원',
    file: '강원도_시군구_경계.svg',
  },
  {
    id: 'chungbuk',
    sourceName: '충청북도',
    name: '충청북도',
    shortName: '충북',
    file: '충청북도_시군구_경계.svg',
  },
  {
    id: 'chungnam',
    sourceName: '충청남도',
    name: '충청남도',
    shortName: '충남',
    file: '충청남도_시군구_경계.svg',
  },
  {
    id: 'jeonbuk',
    sourceName: '전라북도',
    name: '전북특별자치도',
    shortName: '전북',
    file: '전라북도_시군구_경계.svg',
  },
  {
    id: 'jeonnam',
    sourceName: '전라남도',
    name: '전라남도',
    shortName: '전남',
    file: '전라남도_시군구_경계.svg',
  },
  {
    id: 'gyeongbuk',
    sourceName: '경상북도',
    name: '경상북도',
    shortName: '경북',
    file: '경상북도_시군구_경계.svg',
  },
  {
    id: 'gyeongnam',
    sourceName: '경상남도',
    name: '경상남도',
    shortName: '경남',
    file: '경상남도_시군구_경계.svg',
  },
  {
    id: 'jeju',
    sourceName: '제주특별자치도',
    name: '제주특별자치도',
    shortName: '제주',
    file: '제주특별자치도_시군구_경계.svg',
  },
]

export const countryMapFile = '전국_시도_경계.svg'

export const findProvinceBySourceName = (name) =>
  provinces.find((province) => province.sourceName === name)

export const findProvinceById = (id) => provinces.find((province) => province.id === id)

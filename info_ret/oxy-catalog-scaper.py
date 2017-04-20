#!/usr/bin/env python3

import re
from textwrap import indent
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

BASE_URL = 'http://smartcatalog.co/Catalogs/Occidental-College/2016-2017/Catalog/Courses/'

def extract_text(soup):
    text = []
    for desc in soup.descendants:
        if not hasattr(desc, 'contents'):
            if desc:
                text.append(desc)
    return re.sub(r'\s\+', ' ', ''.join(text).strip())

def getYearURL(year):
    return BASE_URL.format(year - 1, year)

def getSoupFromURL(url):
    response = requests.get(url)
    assert response.status_code == 200, 'Downloading {} resulted in HTML status {}'.format(url, response.status_code)
    return BeautifulSoup(response.text , 'html.parser')

def main(year):
    catalog_soup = getSoupFromURL(getYearURL(year))
    for dept_link_soup in catalog_soup.select('.sc-child-item-links li a'):
        dept_soup = getSoupFromURL(urljoin(BASE_URL, dept_link_soup['href']))
        for course_link_soup in dept_soup.select('#main ul li a'):
            text = extract_text(course_link_soup)
            if ' ' not in text:
                continue
            split = [s.strip() for s in text.split(' ', maxsplit=2)]
            assert len(split) == 3, 'Cannot split "{}" into three'.format(text)
            course_dept, course_num, course_title = split
            course_soup = getSoupFromURL(urljoin(BASE_URL, course_link_soup['href']))
            course_desc = extract_text(course_soup.select('#main')[0])
            print('\n'.join(s.strip() for s in course_desc.splitlines() if s.strip()))
            print()

if __name__ == '__main__':
    main(2017)

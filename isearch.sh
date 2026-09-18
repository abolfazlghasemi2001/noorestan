#!/bin/bash
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
curl -s --max-time 45 -A "$UA" -H 'Content-Type: application/json' -X POST \
 'https://hadith.inoor.ir/service/api/elastic/v2/ElasticHadithList' -d "$1"

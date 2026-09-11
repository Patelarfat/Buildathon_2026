import os
import sys
import json
import time
from pathlib import Path
from collections import defaultdict
from ultralytics import YOLO

CLASSES = {
    0: 'helmet',
    1: 'gloves',
    2: 'vest',
    3: 'boots',
    4: 'goggles',
    5: 'none',
    6: 'Person',
    7: 'no_helmet',
    8: 'no_goggle',
    9: 'no_gloves',
    10: 'no_boots'
}

VIOLATION_CLASSES = ['no_helmet', 'no_gloves', 'no_goggle', 'no_boots']
COMPLIANCE_CLASSES = ['helmet', 'gloves', 'vest', 'boots', 'goggles']

def evaluate_model(model_path: str, model_name: str, split: str = 'test', imgsz: int = 640):
    print(f'=== EVALUATING {model_name} on {split.upper()} split ===')
    if not os.path.exists(model_path):
        raise FileNotFoundError(f'Model weights not found at: {model_path}')
    
    model = YOLO(model_path)
    
    start_t = time.time()
    val_res = model.val(
        data='construction-ppe.yaml',
        split=split,
        imgsz=imgsz,
        batch=16,
        device='cpu',
        verbose=False
    )
    total_val_time = time.time() - start_t
    
    rd = val_res.results_dict
    
    p = float(rd.get('metrics/precision(B)', 0.0))
    r = float(rd.get('metrics/recall(B)', 0.0))
    map50 = float(rd.get('metrics/mAP50(B)', 0.0))
    map50_95 = float(rd.get('metrics/mAP50-95(B)', 0.0))
    
    speed = val_res.speed
    
    # Per-class metrics
    per_class = {}
    if hasattr(val_res, 'box'):
        box = val_res.box
        p_per = box.p if hasattr(box, 'p') and box.p is not None else []
        r_per = box.r if hasattr(box, 'r') and box.r is not None else []
        map50_per = box.ap50 if hasattr(box, 'ap50') and box.ap50 is not None else []
        maps_per = box.maps if hasattr(box, 'maps') and box.maps is not None else []
        
        for idx in range(len(CLASSES)):
            c_name = CLASSES[idx]
            per_class[c_name] = {
                'precision': round(float(p_per[idx]), 4) if idx < len(p_per) else 0.0,
                'recall': round(float(r_per[idx]), 4) if idx < len(r_per) else 0.0,
                'map50': round(float(map50_per[idx]), 4) if idx < len(map50_per) else 0.0,
                'map50_95': round(float(maps_per[idx]), 4) if idx < len(maps_per) else 0.0,
            }
            
    res_payload = {
        'model_name': model_name,
        'model_path': model_path,
        'split': split,
        'imgsz': imgsz,
        'overall': {
            'precision': round(p, 4),
            'recall': round(r, 4),
            'map50': round(map50, 4),
            'map50_95': round(map50_95, 4),
        },
        'speed_ms': {
            'preprocess': round(float(speed.get('preprocess', 0.0)), 2),
            'inference': round(float(speed.get('inference', 0.0)), 2),
            'loss': round(float(speed.get('loss', 0.0)), 2),
            'postprocess': round(float(speed.get('postprocess', 0.0)), 2),
            'total_per_image': round(float(speed.get('preprocess', 0.0) + speed.get('inference', 0.0) + speed.get('postprocess', 0.0)), 2)
        },
        'per_class': per_class
    }
    return res_payload

if __name__ == '__main__':
    baseline_path = 'C:/Users/arfat/Buldathon_ps1_2026/backend/ai/weights/best.pt'
    res = evaluate_model(baseline_path, 'YOLO11n (Baseline)')
    print(json.dumps(res, indent=2))

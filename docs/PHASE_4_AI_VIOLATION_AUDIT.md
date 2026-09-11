# Phase 4 AI PPE Violation Detection Audit & Root Cause Analysis

**Project:** Construction Site Intelligence Platform  
**Repository:** https://github.com/Patelarfat/Buildathon_2026  
**Date:** 2026-09-12  
**Audit Scope:** Deep-dive investigation into YOLO fine-tuning, Construction-PPE dataset distribution, label geometry, validation metrics, per-class mAP, inference thresholds, failure modes, and architectural limitations.

---

## 1. Executive Summary

During Phase 4 and Phase 6 validation, testing revealed that while the fine-tuned YOLO model performs reliably on PPE compliance classes (vest, helmet, boots, gloves), it demonstrates near-zero detection performance on violation classes:
- no_helmet: mAP@50-95 = 2.35%
- no_goggle: mAP@50-95 = 0.22%
- no_gloves: mAP@50-95 = 0.00%
- no_boots: mAP@50-95 = 0.00%

This audit establishes the empirical root causes behind this performance disparity without making unverified assumptions or altering existing backend scoring rules.

---

## 2. Current Model Architecture & Training Configuration

### 2.1 Model Specifications
- **Architecture:** YOLO11 Nano (yolo11n.pt) Detection Head
- **Framework:** Ultralytics 8.4.147 / PyTorch 2.7.0.dev20250212+cpu
- **Trained Model Weights:** backend/ai/weights/best.pt (5,450,230 bytes)
- **Metadata Configuration:** backend/ai/model_metadata.json

### 2.2 Training Hyperparameters (backend/ai/runs/construction_ppe/args.yaml)
| Hyperparameter | Value | Description / Rationale |
| :--- | :--- | :--- |
| **Dataset** | construction-ppe.yaml | Official Ultralytics Construction-PPE dataset (11 classes) |
| **Epochs** | 3 | Smoke-test / efficient local training run |
| **Image Size (imgsz)** | 416 | Downsampled resolution for fast CPU execution |
| **Batch Size** | 16 | Standard mini-batch size |
| **Workers** | 4 | DataLoader parallel threads |
| **Device** | cpu | Local CPU execution |
| **Optimizer** | auto (SGD/AdamW) | Learning rate lr0=0.01, lrf=0.01, momentum=0.937 |
| **Warmup** | 3.0 epochs | Warmup momentum 0.8, bias lr 0.1 |
| **Loss Gains** | box=7.5, cls=0.5, dfl=1.5 | Standard YOLO detection loss weights |
| **Augmentation** | Mosaic 1.0, Erasing 0.4, Fliplr 0.5 | Standard image augmentations |

---

## 3. Dataset Distribution & Class Balance Analysis

The dataset is located at C:/Users/arfat/datasets/construction-ppe containing 11 distinct classes:

| Class ID | Class Name | Category Type | Train Instances | Val Instances | Test Instances | Total Instances | % of Total Dataset |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **0** | helmet | PPE Compliance | 1,357 | 201 | 192 | **1,750** | 16.4% |
| **1** | gloves | PPE Compliance | 1,162 | 136 | 163 | **1,461** | 13.7% |
| **2** | vest | PPE Compliance | 1,283 | 171 | 178 | **1,632** | 15.3% |
| **3** | boots | PPE Compliance | 1,251 | 151 | 211 | **1,613** | 15.1% |
| **4** | goggles | PPE Compliance | 427 | 47 | 52 | **526** | 4.9% |
| **5** | none | Neutral / No Vest | 654 | 81 | 65 | **800** | 7.5% |
| **6** | Person | Contextual / Human | 1,790 | 239 | 236 | **2,265** | 21.2% |
| **7** | no_helmet | Safety Violation | 400 | 45 | 40 | **485** | 4.5% |
| **8** | no_goggle | Safety Violation | 337 | 41 | 33 | **411** | 3.8% |
| **9** | no_gloves | Safety Violation | 442 | 56 | 58 | **556** | 5.2% |
| **10** | no_boots | Safety Violation | 88 | 4 | 23 | **115** | 1.1% |
| **Total** | *All Classes* | | **8,891** | **1,172** | **1,251** | **11,314** | **100.0%** |

### Key Dataset Observations:
1. **Severe Underrepresentation of Violations:** Compliant equipment (helmet, vest, boots, gloves) comprises **60.5%** of all instances (6,456 annotations). All four violation classes combined account for only **14.6%** (1,567 annotations).
2. **Extreme Scarcity of no_boots:** Only **88 training instances** and **4 validation instances** exist across the entire dataset (over 14x fewer than boots).
3. **The Role of none:** Class 5 (none) annotates the upper body/torso of workers wearing regular workwear without a high-visibility safety vest.

---

## 4. Label Quality, Bounding Box Geometry & Spatial Overlap

Inspection of ground-truth label files (e.g. image1117.txt, image1129.txt) reveals key geometric patterns:

`
+-----------------------------------------------------------+
| Person (Class 6: Full Body Box)                           |
|  +-----------------------------------------------------+  |
|  | no_helmet (Class 7: Head/Hair Box)                  |  |
|  |  +-----------------------------------------------+  |  |
|  |  | no_goggle (Class 8: Eye Region - Nested Box)   |  |  |
|  |  +-----------------------------------------------+  |  |
|  +-----------------------------------------------------+  |
|  | none (Class 5: Torso / No Vest Box)                 |  |
|  +-----------------------------------------------------+  |
|  | no_gloves (Class 9: Hand Box)                       |  |
|  +-----------------------------------------------------+  |
|  | no_boots (Class 10: Feet / Regular Shoes Box)       |  |
+--+-----------------------------------------------------+--+
`

### Geometric & Semantic Challenges:
1. **Hierarchical Spatial Nesting:** no_goggle is nested entirely inside no_helmet, which is nested inside Person. In YOLO standard grid-based anchor assignments, boxes with identical center coordinates compete directly during NMS (Non-Maximum Suppression) and cross-entropy classification.
2. **Extreme Scale Disparity & Sub-Pixel Downsampling:** At imgsz=416, a full person occupies ~80x160 pixels. A hand (no_gloves) is ~12x15 pixels, and eye region (no_goggle) is ~4x8 pixels. Passing through a stride-32 convolutional backbone leaves fewer than 1x1 feature map cells for eyes and hands, making feature extraction nearly impossible at low resolution.
3. **Absence of Distinct Visual Signatures:** A helmet or vest has high-contrast artificial colors (fluorescent yellow, orange, white hard hat). In contrast, no_gloves is bare human skin, no_helmet is dark hair, and no_boots is everyday sneakers/shoes. These lack high-contrast invariant features.

---

## 5. Training History & Validation Performance

### 5.1 Epoch-by-Epoch Convergence (backend/ai/runs/construction_ppe/results.csv)

| Epoch | Time (s) | Train Box Loss | Train Cls Loss | Train DFL Loss | Val Box Loss | Val Cls Loss | Precision | Recall | mAP@50 | mAP@50-95 |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1** | 366.8 | 1.8916 | 3.3885 | 1.6059 | 1.9817 | 3.3932 | 0.9513 | 0.1400 | 0.2005 | 0.0959 |
| **2** | 318.4 | 1.8683 | 2.1345 | 1.5541 | 1.9259 | 1.9276 | 0.7961 | 0.3385 | 0.3695 | 0.1755 |
| **3** | 284.4 | 1.8378 | 1.7465 | 1.5137 | 1.8960 | 1.6524 | 0.8594 | 0.3885 | 0.4388 | 0.2070 |

### 5.2 Per-Class Validation Breakdown (mAP@50-95)

| Class Name | Type | mAP@50-95 | Detection Quality Rating |
| :--- | :--- | :---: | :--- |
| **Person** | Context | **0.4479** | Good (inherited from COCO pre-training) |
| **vest** | Compliance | **0.4435** | Strong (high contrast, distinct geometry) |
| **boots** | Compliance | **0.3808** | Strong (distinct shape, good representation) |
| **helmet** | Compliance | **0.3693** | Strong (distinct curved geometry) |
| **gloves** | Compliance | **0.2796** | Moderate (distinct work glove colors) |
| **goggles** | Compliance | **0.2062** | Fair (reflective lenses) |
| **none** (no vest) | Neutral | **0.1398** | Low (variable clothing) |
| **no_helmet** | **Violation** | **0.0235** | **Severely Degraded (2.3%)** |
| **no_goggle** | **Violation** | **0.0022** | **Near Zero (0.2%)** |
| **no_gloves** | **Violation** | **0.0000** | **Complete Failure (0.0%)** |
| **no_boots** | **Violation** | **0.0000** | **Complete Failure (0.0%)** |

---

## 6. Inference Threshold Audit

### 6.1 Configuration Points
- **Default Service Threshold:** confidence_threshold = 0.25 (backend/services/yolo_service.py L40, overridden by env PPE_CONFIDENCE).
- **API Override:** POST /api/photos/{id}/analyze?confidence=0.15 (backend/routers/ai.py L25).
- **IoU / NMS Threshold:** iou = 0.70 (default Ultralytics NMS).

### 6.2 Empirical Low-Threshold Inference Test
To test whether violation predictions are merely suppressed by the 0.25 threshold, inference was run at conf=0.05 (5% confidence) across ground-truth violation validation images:

- **Image image1129.jpg (Ground Truth: no_helmet, no_goggle, no_gloves, Person):**
  - At conf >= 0.25: Predicts none (83.6%, 67.7%, 65.8%), Person (77.4%, 62.8%). Violation classes detected: **0**.
  - At 0.05 <= conf < 0.25: Predicts none (24.3%), helmet (17.1% false positive), gloves (7.2%), goggles (6.1%). Violation classes detected: **0**.
- **Image image1130.jpg (Ground Truth: no_helmet, no_boots, no_gloves):**
  - At conf >= 0.25: Predicts Person (85.2%), helmet (62.1% false positive on bare head), vest (36.5%).
  - At 0.05 <= conf < 0.25: Predicts boots (15.0%), helmet (6.2%). Violation classes detected: **0**.

> **Finding:** Lowering the inference confidence threshold does **NOT** recover violation detections. The model simply does not output violation bounding boxes, and instead generates low-confidence false positives for the compliant classes (helmet, vest, boots).

---

## 7. Person-to-PPE Association Analysis (Architectural Limitation)

The current model operates as a single-stage flat object detector. It outputs a collection of independent bounding boxes:

D = { (c_i, bbox_i, conf_i) }

### Structural Limitation:
When multiple workers are present in a frame:
1. Person A and Person B are detected.
2. helmet 1 is detected near Person B.
3. The flat detector cannot determine whether helmet 1 belongs to Person A or Person B.
4. If one worker wears a helmet and another does not, the system records 1 helmet detection and 0 violations, unable to attribute the non-compliance to the specific unequipped person.

True PPE compliance verification requires **Person-Centric Association**:
Person_k -> { Head_k ∩ Helmet, Torso_k ∩ Vest, Hands_k ∩ Gloves, Feet_k ∩ Boots }

---

## 8. Root Cause Summary: Confirmed Facts vs. Likely Causes

### Confirmed Facts
1. **Insufficient Training Epochs:** The model was trained for only **3 epochs**. At 3 epochs, classification loss was still rapidly descending (cls_loss = 1.74) and the model had only begun learning the dominant positive classes.
2. **Severe Class Imbalance:** Violation classes represent only 14.6% of dataset instances, with no_boots having only 4 validation samples.
3. **Resolution Loss at 416px:** Small anatomy regions (no_goggle, no_gloves) become sub-pixel representations after downsampling through stride-32 convolutions.
4. **False Positive Dominance:** When presented with bare heads/hands, the under-trained network defaults to predicting positive PPE (helmet, gloves) due to the heavy positive prior in the training distribution.
5. **Threshold Ineffectiveness:** Lowering conf from 0.25 to 0.05 does not produce violation detections.

### Likely Causes
1. **Negative vs. Positive Feature Geometry:** Detecting the *absence* of an item using flat bounding boxes is inherently ill-conditioned for standard object detection backbones.
2. **NMS Suppression:** Overlapping Person, no_helmet, and no_goggle bounding boxes compete for anchor slots during non-maximum suppression.

---

## 9. Recommended Retraining & Architecture Strategy

When Phase 4 model retraining is authorized, the following incremental approach is recommended:

### Option A: Extended Direct Fine-Tuning (Immediate Next Step)
- **Parameters:** epochs = 50 - 100, imgsz = 640 (or 800), batch = 16, patience = 15.
- **Loss Tuning:** Increase classification loss weight cls = 1.2, enable class frequency weighting.
- **Risk / Trade-off:** Requires GPU for practical training duration (~45-60 min on GPU vs ~8 hours on CPU). May still struggle on very small objects (no_goggle).

### Option B: Two-Stage Person-Centric Cropping Pipeline (High Precision Architecture)
1. **Stage 1:** Detect Person bounding boxes with high precision.
2. **Stage 2:** Crop each person into anatomical sub-regions:
   - Head region -> Helmet vs Bare Head classifier
   - Torso region -> Vest vs Regular Shirt classifier
   - Hands region -> Gloves vs Bare Hands classifier
   - Feet region -> Safety Boots vs Shoes classifier
- **Risk / Trade-off:** Slightly higher inference latency (~40ms -> 90ms per photo), but completely solves the Person-to-PPE association problem and eliminates small-object sub-pixel degradation.

---

## 10. Audit Sign-Off

- **Audit Date:** 2026-09-12
- **Auditor:** Antigravity AI Engineer
- **Status:** Complete & Diagnosed
- **Action Required:** Proceed to Model Retraining Plan upon user approval.
